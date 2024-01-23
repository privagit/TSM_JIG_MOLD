const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const Redis = require('ioredis');
const redis = new Redis();


//* ========= Repair Issue =========
router.post('/repair-issue', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { month, year, Status } = req.body;

        let repairIssue = await pool.request().query(`SELECT a.RepairCheckID, b.JigNo, a.RequestTime, a.StartTime, a.EndTime, a.Complaint,
        a.RepairResult, a.ApproveBy, a.ReportNo
        FROM [Jig].[RepairCheck] a
        LEFT JOIN [Jig].[MasterJig] b ON b.JigID = a.JigID
        WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year}
        ORDER BY a.RequestTime
        `);

        //* Filter Status
        if(Status){ //* Status: All = null, 1: Issue, 2: Repair, 3: Wait Sign, 4: Complete
            if(Status == 1){
                let repairIssueFiltered = repairIssue.recordset.filter(v => !v.StartTime && !v.EndTime);
                return res.json(repairIssueFiltered);
            }
            else if(Status == 2){
                let repairIssueFiltered = repairIssue.recordset.filter(v => v.StartTime && !v.EndTime);
                return res.json(repairIssueFiltered);
            }
            else if(Status == 3){
                let repairIssueFiltered = repairIssue.recordset.filter(v => v.StartTime && v.EndTime && !v.ApproveBy);
                return res.json(repairIssueFiltered);
            }
            else if(Status == 4){
                let repairIssueFiltered = repairIssue.recordset.filter(v => v.StartTime && v.EndTime && v.ApproveBy);
                return res.json(repairIssueFiltered);
            }
        }

        res.json(repairIssue.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/dropdown/jig', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let jigs = await pool.request().query(`SELECT a.JigID, a.JigNo, a.JigTypeID, b.JigType FROM [Jig].[MasterJig] a
        LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID
        WHERE a.Active = 1
        `);
        res.json(jigs.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/dropdown/problem/type', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let problemType = await pool.request().query(`SELECT a.RepairTypeID, a.RepairType
        FROM [Jig].[MasterRepairType] a
        WHERE a.Active = 1;
        `);
        res.json(problemType.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/dropdown/problem', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTypeID } = req.body;
        let problem = await pool.request().query(`SELECT a.RepairProblemID, a.RepairProblem
        FROM [Jig].[MasterRepairProblem] a
        WHERE a.RepairTypeID = ${RepairTypeID} AND a.Active = 1;
        `);
        res.json(problem.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Request
router.post('/repair-issue/request/issue', async (req, res) => { // cache, RunningNo., io
    try {
        let pool = await sql.connect(config);
        let { JigID, RequestBy, RequestTime, Section, Complaint, RepairTypeID, RepairProblemID } = req.body;
         //* Get RunningNo
        let date = new Date();
        let monthRunningNo = await pool.request().query(`SELECT a.MonthDate, a.RunningNo
        FROM [MonthRunningNo] a
        WHERE Month(MonthDate) = ${date.getMonth()+1} AND YEAR(MonthDate) = ${date.getFullYear()};
        `);
        if(monthRunningNo.recordset.length){
            var RunningNo = monthRunningNo.recordset[0].RunningNo + 1;
            await pool.request().query(`UPDATE [MonthRunningNo] SET RunningNo = ${RunningNo} WHERE Month(MonthDate) = ${date.getMonth()+1} AND YEAR(MonthDate) = ${date.getFullYear()};`);
        } else{
            var RunningNo = 1;
            await pool.request().query(`INSERT INTO [MonthRunningNo](MonthDate, RunningNo) VALUES('${date.getFullYear()}-${date.getMonth()+1}-1', 1)`);
        }
        let ReportNo = `EM-${('0000'+RunningNo).substr(-4)}-${('00'+(date.getMonth()+1)).substr(-2)}-${date.getFullYear().toString().substr(-2)}`;

        let issueRepair = await pool.request().query(`INSERT INTO [Jig].[RepairCheck](JigID, RequestBy, RequestTime, Section, Complaint, RepairTypeID, RepairProblemID, ReportNo)
        VALUES(${JigID}, '${RequestBy}', '${RequestTime}', '${Section}', N'${Complaint}', ${RepairTypeID}, ${RepairProblemID}, '${ReportNo}');

        SELECT SCOPE_IDENTITY() AS RepairCheckID;
        `);

        // let date = new Date();
        const io = req.app.get('socketio');
        let machine = await pool.request().query(`SELECT JigNo FROM [Jig].[MasterJig] WHERE JigID = ${JigID};`);
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        let alertLog = { MachineNo: machine.recordset[0]?.JigNo, Module: 1, Action: 1, time: alertTime, date: alertDate };
        io.emit('alert-log', alertLog);
        let cacheAlertLog = await redis.get('em-alert-log');
        if(!cacheAlertLog){
            await redis.set('em-alert-log', JSON.stringify([alertLog]));
        } else {
            let cur = new Date();
            let cacheAlertLogJSON = JSON.parse(cacheAlertLog);
            let cacheAlertLogFilter = cacheAlertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
            cacheAlertLogFilter.push(alertLog);
            await redis.set('em-alert-log', JSON.stringify(cacheAlertLogFilter));
        }

        res.json({ message: 'Success', RepairCheckID: issueRepair.recordset[0]?.RepairCheckID });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Repair
router.post('/repair-issue/repair/start', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${(cur.getMonth()+1).toString().padStart(2,'0')}-${(cur.getDate()).toString().padStart(2,'0')} ${cur.getHours().toString().padStart(2,'0')}:${cur.getMinutes().toString().padStart(2,'0')}`;
        let startRepair = `UPDATE [Jig].[RepairCheck] SET StartTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(startRepair);

        res.json({ message: 'Success', StartTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/item', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

        let repair = await pool.request().query(`SELECT a.RepairCheckID, a.RequestTime, a.RepairProblemID, a.RepairTypeID, a.Complaint,
        a.StartTime, a.EndTime, a.RootCause, a.FixDetail, a.TestDummyResult, a.RepairResult,
        b.FirstName AS RequestSign, c.FirstName AS RepairBy, d.FirstName AS ApproveBy, e.FirstName AS ReceiveBy,
        f.FirstName AS ReceiveApproveBy
        FROM [Jig].[RepairCheck] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.RequestBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.RepairBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.ApproveBy = d.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON a.ReceiveBy = e.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON a.ReceiveApproveBy = f.EmployeeID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);
        if(repair.recordset.length){
            repair.recordset[0].RequestSign = !repair.recordset[0].RequestSign ? null: atob(repair.recordset[0].RequestSign);
            repair.recordset[0].RepairBy = !repair.recordset[0].RepairBy ? null: atob(repair.recordset[0].RepairBy);
            repair.recordset[0].ApproveBy = !repair.recordset[0].ApproveBy ? null: atob(repair.recordset[0].ApproveBy);
            repair.recordset[0].ReceiveBy = !repair.recordset[0].ReceiveBy ? null: atob(repair.recordset[0].ReceiveBy);
            repair.recordset[0].ReceiveApproveBy = !repair.recordset[0].ReceiveApproveBy ? null: atob(repair.recordset[0].ReceiveApproveBy);
        }
        res.json(repair.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, RootCause, FixDetail, TestDummyResult } = req.body;

        let updateRepair = `UPDATE [Jig].[RepairCheck] SET RootCause = N'${RootCause}', FixDetail = N'${FixDetail}',
        TestDummyResult = ${TestDummyResult}
        WHERE RepairCheckID = ${RepairCheckID};
        `;
        await pool.request().query(updateRepair);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Tech
router.post('/repair-issue/repair/tech', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

        let techs = await pool.request().query(`SELECT a.RepairTechID, b.FirstName AS TechName
        FROM [Jig].[RepairTech] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.EmployeeID = b.EmployeeID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);
        for(let t of techs.recordset){
            t.TechName = atob(t.TechName);
        }

        res.json(techs.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/tech/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, EmployeeID } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let insertTech = await pool.request().query(`DECLARE @CntTech INT;
        SELECT @CntTech = COUNT(RepairTechID) FROM [Jig].[RepairTech] WHERE EmployeeID = ${EmployeeID} AND RepairCheckID = ${RepairCheckID};

        IF(@CntTech = 0)
        BEGIN
            INSERT INTO [Jig].[RepairTech](RepairCheckID, EmployeeID) VALUES(${RepairCheckID}, ${EmployeeID});
            SELECT @CntTech AS CntTech;
        END
        ELSE
        BEGIN
            SELECT @CntTech AS CntTech;
        END;
        `);

        if(insertTech.recordset[0]?.CntTech) return res.status(400).send({ message: 'ขออภัย รหัสพนักงานซ้ำ' });

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair-issue/repair/tech/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTechID } = req.body;

        let deleteTech = `DELETE FROM [Jig].[RepairTech] WHERE RepairTechID = ${RepairTechID};`;
        await pool.request().query(deleteTech);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Service / Parts Cost
router.post('/repair-issue/service/dropdown/category', async (req, res) => {
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
router.post('/repair-issue/service/dropdown/sparepart', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareCategoryID } = req.body;
        let sparepart = await pool.request().query(`SELECT a.SpareID, a.SpareName, a.Price
        FROM [Jig].[MasterSpare] a
        WHERE a.SpareCategoryID = ${SpareCategoryID} AND a.Active = 1;
        `);
        res.json(sparepart.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/service', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

        let PartsCost = await pool.request().query(`SELECT a.RepairCheckID, a.RepairCheckID, a.SpareID, b.SpareName, a.Qty, a.UnitPrice, a.UsedDate,
        (a.UnitPrice * a.Qty) AS Amounth, a.Reuse
        FROM [Jig].[RepairCost] a
        LEFT JOIN [Jig].[MasterSpare] b ON a.SpareID = b.SpareID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);

        res.json(PartsCost.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/service/add', async (req, res) => { // ถ้า Use มากกว่า Remain
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, SpareID, Qty, UnitPrice, Reuse } = req.body;

        // Get Remain
        let getRemain = await pool.request().query(`DECLARE @BF INT,
        @Received INT,
        @Used INT,
        @Purchase INT;

        SELECT @BF = a.BF, @Received = a.Received, @Purchase = a.Purchase
        FROM [Jig].[SpareMonth] a
        WHERE MONTH(a.MonthYear) = MONTH(GETDATE()) AND YEAR(a.MonthYear) = YEAR(GETDATE()) AND a.SpareID = ${SpareID};

        SELECT @Used = SUM(a.Qty)
        FROM [Jig].[RepairCost] a
        WHERE MONTH(a.UsedDate) = MONTH(GETDATE()) AND YEAR(a.UsedDate) = YEAR(GETDATE()) AND a.SpareID = ${SpareID};

        SELECT ISNULL(@BF,0) + ISNULL(@Received,0) + ISNULL(@Purchase,0) - ISNULL(@Used,0) AS Remain;
        `);
        let remain = getRemain.recordset[0]?.Remain || 0;
        if(Qty > remain) return res.status(400).send({ message: 'คงเหลือใน Stock น้อยกว่าที่ใช้' });


        let insertPart = `INSERT [Jig].[RepairCost](RepairCheckID, SpareID, Qty, UnitPrice, UsedDate, Reuse)
        VALUES(${RepairCheckID}, ${SpareID}, ${Qty}, ${UnitPrice}, GETDATE(), ${Reuse});
        `;
        await pool.request().query(insertPart);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair-issue/service/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCostID } = req.body;

        let deletePart = `DELETE FROM [Jig].[RepairCost] WHERE RepairCostID = ${RepairCostID};`;
        await pool.request().query(deletePart);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
//TODO: Requestor Section
router.post('/', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Sign
router.post('/repair-issue/sign/repair', async (req, res) => { //* cache, io
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, RepairBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${RepairBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[RepairCheck] SET RepairBy = ${RepairBy}, EndTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRepair);

        // Socket io
        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let machine = await pool.request().query(`SELECT b.JigNo
        FROM [Jig].[RepairCheck] a
        LEFT JOIN [Jig].[MasterJig] b ON b.JigID = a.JigID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);
        let alertLog = { JigNo: machine.recordset[0]?.JigNo, Module: 1, Action: 2, time: alertTime, date: alertDate }
        io.emit('alert-log', alertLog);
        let cacheAlertLog = await redis.get('em-alert-log');
        if(!cacheAlertLog){
            await redis.set('jig-alert-log', JSON.stringify([alertLog]));
        } else {
            let cur = new Date();
            let cacheAlertLogJSON = JSON.parse(cacheAlertLog);
            let cacheAlertLogFilter = cacheAlertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
            cacheAlertLogFilter.push(alertLog);
            await redis.set('jig-alert-log', JSON.stringify(cacheAlertLogFilter));
        }

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), EndTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/approve', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Jig].[RepairCheck] SET ApproveBy = ${ApproveBy}, ApproveTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/receive', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, ReceiveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ReceiveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signReceive = `UPDATE [Jig].[RepairCheck] SET ReceiveBy = ${ReceiveBy}, ReceiveTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signReceive);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/receive-approve', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, ReceiveApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ReceiveApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signReceiveApprove = `UPDATE [Jig].[RepairCheck] SET ReceiveApproveBy = ${ReceiveApproveBy}, ReceiveApproveTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signReceiveApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;