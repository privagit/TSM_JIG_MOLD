const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');

//* ========= Spare Part ==========
router.post('/dropdown/category', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let category = await pool.request().query(`SELECT a.SpareCategoryID, a.Category
        FROM [Jig].[MasterSpareCategory] a
        WHERE a.Active = 1;
        `);
        res.json(category.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/dropdown/supplier', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let suppliers = await pool.request().query(`SELECT a.SupplierID, a.SupplierName
        FROM [Jig].[MasterSupplier] a
        WHERE a.Active = 1;
        `);
        res.json(suppliers.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/spare-part', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareCategoryID, month, year } = req.body;

        let spares = await pool.request()
        .input('Month', sql.Int, month)
        .input('Year', sql.Int, year)
        .execute('SparePartMonth');

        let repairs = await pool.request().query(`SELECT a.SpareID, a.Qty, d.Location, e.FirstName AS UsedBy, DAY(a.UsedDate) AS D
        FROM [Jig].[RepairCost] a
        LEFT JOIN [Jig].[RepairCheck] b ON b.RepairCheckID = a.RepairCheckID
        LEFT JOIN [Jig].[MasterSpare] c ON c.SpareID = a.SpareID
        LEFT JOIN [Jig].[MasterSpareLocation] d ON d.SpareLocationID = c.SpareLocationID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON e.EmployeeID = b.RepairBy
        WHERE MONTH(b.RequestTime) = ${month} AND YEAR(b.RequestTime) = ${year};
        `);

        await Promise.all(spares.recordset.map(async (spare) => {
            let repairFiltered = repairs.recordset.filter(v => v.SpareID == spare.SpareID);

            for(let item of repairFiltered){
                item.UsedBy = !item.UsedBy ? null : atob(item.UsedBy);
                if(typeof spare[`D${item.D}`] == 'number'){
                    spare[`D${item.D}`] = {
                        Used: spare[`D${item.D}`],
                        Restock: [item]
                    }
                } else{
                    spare[`D${item.D}`].Restock.push(item);
                }
            }
        }))

        //* Filter Category
        if(SpareCategoryID){ //* Category All = null
            let spareFiltered = spares.recordset.filter(v => v.SpareCategoryID == SpareCategoryID);
            return res.json(spareFiltered);
        }

        res.json(spares.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/spare-part/restock', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareID, month, year, ReceiveDate, RestockType, SupplierID, PrNo, PoNo, InvoiceNo, Qty, Price, ReceiveBy } = req.body;

        //* Restock: increase Received
        var restockSpare = `
        DECLARE @SpareMonthID BIGINT,
            @OldPrice FLOAT,
            @NewPrice FLOAT;

        -- Update Price
        SELECT @OldPrice = Price, @NewPrice = ${Price} FROM [Jig].[MasterSpare] WHERE SpareID = ${SpareID};
        IF(@OldPrice != @NewPrice)
        BEGIN
            UPDATE [Jig].[MasterSpare] SET Price = ${Price} WHERE SpareID = ${SpareID};
        END

        -- Get from [SpareMonth]
        SELECT @SpareMonthID = a.SpareMonthID
        FROM [Jig].[SpareMonth] a
        WHERE a.SpareID = ${SpareID} AND MONTH(a.MonthYear) = ${month} AND YEAR(a.MonthYear) = ${year};

        IF(@SpareMonthID IS NULL)
        BEGIN
            INSERT INTO [Jig].[SpareMonth](SpareID, MonthYear, Received) VALUES(${SpareID}, '${year}-${month}-1', ${Qty});
            SELECT @SpareMonthID = SCOPE_IDENTITY();

            INSERT INTO [Jig].[SpareRestock](SpareMonthID, ReceiveDate, RestockType, SupplierID, PrNo, PoNo, InvoiceNo, Qty, Price, ReceiveBy)
            VALUES(@SpareMonthID, '${ReceiveDate}', ${RestockType}, ${SupplierID}, N'${PrNo}', N'${PoNo}', N'${InvoiceNo}', ${Qty}, ${Price}, '${ReceiveBy}');
        END
        ELSE
        BEGIN
            UPDATE [Jig].[SpareMonth] SET Received = Received + ${Qty} WHERE SpareMonthID = @SpareMonthID;

            INSERT INTO [Jig].[SpareRestock](SpareMonthID, ReceiveDate, RestockType, SupplierID, PrNo, PoNo, InvoiceNo, Qty, Price, ReceiveBy)
            VALUES(@SpareMonthID, '${ReceiveDate}', ${RestockType}, ${SupplierID}, N'${PrNo}', N'${PoNo}', N'${InvoiceNo}', ${Qty}, ${Price}, '${ReceiveBy}');
        END;
        `;
        await pool.request().query(restockSpare);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/spare-part/history', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareID, month, year } = req.body;
        let restocks = await pool.request().query(`SELECT a.RestockSpareID, a.ReceiveDate
		FROM [Jig].[SpareRestock] a
        LEFT JOIN [Jig].[SpareMonth] b ON a.SpareMonthID = b.SpareMonthID
		WHERE b.SpareID = ${SpareID} AND MONTH(a.ReceiveDate) = ${month} AND YEAR(a.ReceiveDate) = ${year}
        ORDER BY a.ReceiveDate
        `);
        res.json(restocks.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/spare-part/history/item', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RestockSpareID } = req.body;

        //* Restock: increase Received
        let restockSpare = await pool.request().query(`SELECT a.RestockSpareID, a.SpareMonthID, a.ReceiveDate, a.RestockType, a.SupplierID,
        a.PrNo, a.PoNo, a.InvoiceNo, a.Qty, a.Price, a.Amount, b.FirstName AS ReceiveName, c.SupplierName
        FROM [Jig].[SpareRestock] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.ReceiveBy = b.EmployeeID
        LEFT JOIN [Jig].[MasterSupplier] c ON c.SupplierID = a.SupplierID
        WHERE a.RestockSpareID = ${RestockSpareID};
        `);
        if(restockSpare.recordset.length){
            restockSpare.recordset[0].ReceiveName = !restockSpare.recordset[0].ReceiveName ? null: atob(restockSpare.recordset[0].ReceiveName);
        }

        res.json(restockSpare.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/spare-part/user/check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { ReceiveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ReceiveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        if(getUser.recordset.length){
            getUser.recordset[0].ReceiveName = !getUser.recordset[0].FirstName ? null: atob(getUser.recordset[0].FirstName)
        }
        res.json(getUser.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;