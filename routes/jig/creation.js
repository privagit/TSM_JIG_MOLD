const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

router.post('/', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let item = await pool.request().query(`
        `);
        res.json(item.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Jig Creation ==========
router.post('/list', async (req, res) => { //TODO: FinishDate, Status, PartList, TrialCount, Evaluation
    try {
        let pool = await sql.connect(config);
        let { RequestSection, Status } = req.body;
        let jigCreateList = await pool.request().query(`SELECT a.JigCreationID, NULL AS JigNo, a.CustomerID, b.CustomerName, a.PartCode, a.PartName, a.RequestSection, 
        CONVERT(NVARCHAR, a.RequestDate, 23) AS RequestDate, CONVERT(NVARCHAR, a.RequiredDate, 23) AS RequiredDate,
        a.Quatity, a.JigTypeID, c.JigType, a.RequestType, a.Budget, a.CustomerBudget
        FROM [Jig].[JigCreation] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Jig].[MasterJigType] c ON c.JigTypeID = a.JigTypeID
        `);
        res.json(jigCreateList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageJigRequestImage = multer.diskStorage({
    destination: path.join(__dirname, '../public/jig/request'),
    filename: (req, file, cb) => {
        let { JigID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${JigID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadJigRequestImage = multer({ storage: storageJigRequestImage }).single('jig_request_image');
router.post('/issue', async (req, res) => {
    uploadJigRequestImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let RequestImagePath = (req.file) ? "/jig/request/" + req.file.filename : "";
                let { CustomerID, JigTypeID, PartCode, PartName, RequiredDate, RequestTime, Quantity, RequestSection, RequestType,
                    ProductionDate, Budget, CustomerBudget, FgMonthQty, FgYearQty, UseIn, Requirement } = req.body;
                let insertJigCreate = await pool.request().query(`INSERT INTO [Jig].[JigCreation](CustomerID, JigTypeID, PartCode, PartName,
                    RequiredDate, RequestTime, Quantity, RequestSection, RequestType,
                    ProductionDate, Budget, CustomerBudget, FgMonthQty, FgYearQty, UseIn, Requirement, RequestImagePath)
                    VALUES(${CustomerID}, ${JigTypeID}, N'${PartCode}', N'${PartName}',
                    '${RequiredDate}', '${RequestTime}', ${Quantity}, ${RequestSection}, ${RequestType},
                    '${ProductionDate}', ${Budget}, ${CustomerBudget}, ${FgMonthQty}, ${FgYearQty}, ${UseIn}, N'${Requirement}', '${RequestImagePath}'
                    );
                `);
                await pool.request().query(insertJigCreate);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

//* ===== Request Jig =====
router.post('/request/item', async (req, res) => { //TODO: Table Project
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigCreateList = await pool.request().query(`SELECT a.JigCreationID, a.JlNo, a.CustomerID, a.JigTypeID, a.PartCode, a.PartName, a.Quantity, a.RequiredDate,
        a.RequestTime, a.RequestSection, a.RequestType, a.ProductionDate, a.Budget, a.CustomerBudget, a.FgMonthQty, a.FgYearQty,
        a.UseIn, a.Requirement, a.RequestImagePath, a.ConfirmDateResult, a.ConfirmDate, a.ExamResult, a.Reason,
        b.FirstName AS ResponsibleBy,
        c.FirstName AS RequestBy, a.RequestSignTime,
        d.FirstName AS CheckedBy, a.CheckedSignTime,
        e.FirstName AS ApproveBy, a.ApproveSignTime,
        f.FirstName AS ExamRequestBy, a.ExamRequestSignTime,
        g.FirstName AS ExamCheckedBy, a.ExamCheckedSignTime,
        h.FirstName AS ExamApproveBy, a.ExamApproveSignTime
        FROM [Jig].[JigCreation] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.ResponsibleBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.RequestBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.CheckedBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON e.EmployeeID = a.ApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON f.EmployeeID = a.ExamRequestBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] g ON g.EmployeeID = a.ExamCheckedBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] h ON h.EmployeeID = a.ExamApproveBy
        WHERE a.JigCreationID = ${JigCreationID};
        `);
        res.json(jigCreateList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/confirm-target-date/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ConfirmDateResult, ConfirmDate } = req.body;
        let updateConfirmTarget = `UPDATE [Jig].[JigCreation] SET ConfirmDateResult = ${ConfirmDateResult}, ConfirmDate = '${ConfirmDate}'
        WHERE JigCreationID = ${JigCreationID};
        `;
        await pool.request().query(updateConfirmTarget);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/tooling/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ExamResult, Reason } = req.body;
        let updateConfirmTarget = `UPDATE [Jig].[JigCreation] SET ExamResult = ${ExamResult}, Reason = '${Reason}'
        WHERE JigCreationID = ${JigCreationID};
        `;
        await pool.request().query(updateConfirmTarget);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/responsible', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ResponsibleBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ResponsibleBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let signRepair = `UPDATE [Jig].[JigCreation] SET ResponsibleBy = ${ResponsibleBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName) });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/request', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, RequestBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${RequestBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET RequestBy = ${RequestBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, CheckedBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckedBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET CheckedBy = ${CheckedBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/approve', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET ApproveBy = ${ApproveBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/exam-request', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ExamRequestBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ExamRequestBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET ExamRequestBy = ${ExamRequestBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/exam-check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ExamCheckedBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ExamCheckedBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET ExamCheckedBy = ${ExamCheckedBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign/exam-approve', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, ExamApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ExamApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigCreation] SET ExamApproveBy = ${ExamApproveBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ===== Part List =====



//* ===== Work List =====



//* ===== Modify Jig =====



//* ===== Trial =====



//* ===== Evaluation =====



//* ===== Comment =====
