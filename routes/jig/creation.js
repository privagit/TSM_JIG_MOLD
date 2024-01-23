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
    destination: path.join(__dirname, '../../public/jig/request'),
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
                    console.log(req.file.filename)
                    console.log(req.body)
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
router.post('/request', async (req, res) => { //TODO: Table Project
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigRequest = await pool.request().query(`SELECT a.JigCreationID, a.JlNo, a.CustomerID, a.JigTypeID, a.PartCode, a.PartName, a.Quantity, a.RequiredDate,
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
        for(let item of jigRequest.recordset){
            item.ResponsibleBy = !item.ResponsibleBy ? null : atob(item.ResponsibleBy);
            item.RequestBy = !item.RequestBy ? null : atob(item.RequestBy);
            item.CheckedBy = !item.CheckedBy ? null : atob(item.CheckedBy);
            item.ApproveBy = !item.ApproveBy ? null : atob(item.ApproveBy);
            item.ExamRequestBy = !item.ExamRequestBy ? null : atob(item.ExamRequestBy);
            item.ExamCheckedBy = !item.ExamCheckedBy ? null : atob(item.ExamCheckedBy);
            item.ExamApproveBy = !item.ExamApproveBy ? null : atob(item.ExamApproveBy);
        }
        res.json(jigRequest.recordset);
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
router.put('/request/sign', async (req, res) => { //todo ส่งเวลา Sign In มาด้วย
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, EmployeeID, itemNo } = req.body;
        let itemMap = { 1: 'Responsible', 2: 'Request', 3: 'Checked', 4: 'Approve', 5: 'ExamRequest', 6: 'ExamChecked', 7: 'ExamApprove' };

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        if(itemNo == 1){ // responsible
            let signResponsible = `UPDATE [Jig].[JigCreation] SET ResponsibleBy = ${EmployeeID} WHERE JigCreationID = ${JigCreationID};`;
            await pool.request().query(signResponsible);
        } else{ // request, check, approve
            let signResponsible = `UPDATE [Jig].[JigCreation] SET ${itemMap[itemNo]}By = ${EmployeeID}, ${itemMap[itemNo]}SignTime = GETDATE()  WHERE JigCreationID = ${JigCreationID};`;
            await pool.request().query(signResponsible);
        }

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName) });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Part List =====
router.post('/part-list', async (req, res) => { //! TODO:
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigPartList = await pool.request().query(`SELECT a.PartListID, a.PartList, b.FirstName AS ApproveBy, a.ApproveSignTime, a.JigCreationID
        FROM [Jig].[JigPartList] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.ApproveBy
        WHERE JigCreationID = 1;
        `);
        res.json(jigPartList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/part-list/edit', async (req, res) => { //! TODO:
    try {
        let pool = await sql.connect(config);
        let { PartListID, JigCreationID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Jig].[JigPartList] SET ApproveBy = ${ApproveBy} WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/part-list/sign/approve', async (req, res) => { //! TODO:
    try {
        let pool = await sql.connect(config);
        let { PartListID, JigCreationID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Jig].[JigPartList] SET ApproveBy = ${ApproveBy}, ApproveSignTime = GETDATE() WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Work List =====
router.post('/work-list', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigWorkList = await pool.request().query(`SELECT a.WorkListID, a.WorkType, a.StartTime, a.FinishTime, a.Detail, a.Responsible, a.Remark
        FROM [Jig].[JigWorkList] a
        WHERE a.JigCreationID = ${JigCreationID} AND Active = 1;
        `);
        res.json(jigWorkList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/work-list/add', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, WorkType, StartTime, FinishTime, Detail, Responsible, Remark } = req.body;
        console.log(req.body)
        let insertWorkList = `INSERT INTO [Jig].[JigWorkList](JigCreationID, WorkType, StartTime, FinishTime, Detail, Responsible, Remark, Active)
        VALUES(${JigCreationID}, N'${WorkType}', '${StartTime}', '${FinishTime}', N'${Detail}', N'${Responsible}', N'${Remark}' , 1);
        `;
        await pool.request().query(insertWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/work-list/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { WorkListID, WorkType, StartTime, FinishTime, Detail, Responsible, Remark } = req.body;
        let updateWorkList = `UPDATE [Jig].[JigWorkList] SET WorkType = N'${WorkType}', StartTime = '${StartTime}', FinishTime = '${FinishTime}',
        Detail = N'${Detail}', Responsible = N'${Responsible}', Remark = N'${Remark}' WHERE WorkListID = ${WorkListID};
        `;
        await pool.request().query(updateWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/work-list/delete', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { WorkListID } = req.body;
        let deleteWorkList = `UPDATE [Jig].[JigWorkList] SET Active = 0 WHERE WorkListID = ${WorkListID};`;
        await pool.request().query(deleteWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Modify Jig =====
router.post('/modify', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigModify = await pool.request().query(`SELECT a.ModifyID, a.JigCreationID, a.ModifyNo, a.ModifyDate, a.CustomerBudget, a.Responsible,
        a.Problem, a.Solution, a.Detail, a.Benefit, a.Cost, a.BeforeImagePath, a.AfterImagePath
        FROM [Jig].[JigModify] a
        WHERE a.JigCreationID = ${JigCreationID}
        ORDER BY ModifyNo;
        `);
        res.json(jigModify.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/modify/add', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let insertModify = `INSERT INTO [Jig].[JigModify](JigCreationID) VALUES(${JigCreationID});`;
        await pool.request().query(insertModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/modify/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { ModifyID, ModifyNo, ModifyDate, CustomerBudget, Responsible, Problem, Solution, Detail, Benefit, Cost } = req.body;
        let updateModify = `UPDATE [Jig].[JigWorkList] SET ModifyNo = ${ModifyNo}, ModifyDate = '${ModifyDate}', CustomerBudget = ${CustomerBudget},
        Responsible = N'${Responsible}', Problem = N'${Problem}', Solution = N'${Solution}', Detail = N'${Detail}', Benefit = N'${Benefit}', Cost = N'${Cost}'
        WHERE ModifyID = ${ModifyID};
        `;
        await pool.request().query(updateModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageModifyBefore = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/modify/before'),
    filename: (req, file, cb) => {
        let { JigCreationID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${JigCreationID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadModifyBefore = multer({ storage: storageModifyBefore }).single('jig_modify_before');
const storageModifyAfter = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/modify/after'),
    filename: (req, file, cb) => {
        let { JigCreationID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${JigCreationID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadModifyAfter = multer({ storage: storageModifyAfter }).single('jig_modify_after');

router.post('/modify/upload/before', async (req, res) => {
    uploadModifyBefore(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/jig/modify/before/" + req.file.filename : "";
                let { ModifyID, JigCreationID } = req.body;
                let updateModifyBefore = `UPDATE [Jig].[JigModify] SET BeforeImagePath = N'${ImagePath}' WHERE ModifyID = ${ModifyID};`;
                await pool.request().query(updateModifyBefore);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.post('/modify/upload/after', async (req, res) => {
    uploadModifyAfter(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/jig/modify/after/" + req.file.filename : "";
                let { ModifyID, JigCreationID } = req.body;
                let updateModifyAfter = `UPDATE [Jig].[JigModify] SET AfterImagePath = N'${ImagePath}' WHERE ModifyID = ${ModifyID};`;
                await pool.request().query(updateModifyAfter);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
//TODO: รายละเอียดค่าใช้จ่ายอื่นๆ


//* ===== Trial =====
router.post('/trial', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigTrial = await pool.request().query(`SELECT a.TrialID, CONVERT(NVARCHAR, a.PlanStart, 23) AS TestDate, a.Qty,
        FORMAT(a.PlanStart, 'HH:MM') AS PlanStart, FORMAT(a.PlanFinish, 'HH:MM') AS PlanFinish,
        DATEDIFF(HOUR, a.PlanStart, a.PlanFinish) AS PlanTime,
        FORMAT(a.ActualStart, 'HH:MM') AS ActualStart, FORMAT(a.ActualFinish, 'HH:MM') AS ActualFinish,
        DATEDIFF(HOUR, a.ActualStart, a.ActualFinish) AS ActualTime,
        a.Problem, a.Reason, a.FixDetail, a.Remark
        FROM [Jig].[JigTrial] a
        WHERE a.JigCreationID = ${JigCreationID};
        `);
        res.json(jigTrial.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/trial/add', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let insertModify = `INSERT INTO [Jig].[JigModify](JigCreationID) VALUES(${JigCreationID});`;
        await pool.request().query(insertModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/trial/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { ModifyID, ModifyNo, ModifyDate, CustomerBudget, Responsible, Problem, Solution, Detail, Benefit, Cost } = req.body;
        let updateModify = `UPDATE [Jig].[JigWorkList] SET ModifyNo = ${ModifyNo}, ModifyDate = '${ModifyDate}', CustomerBudget = ${CustomerBudget},
        Responsible = N'${Responsible}', Problem = N'${Problem}', Solution = N'${Solution}', Detail = N'${Detail}', Benefit = N'${Benefit}', Cost = N'${Cost}'
        WHERE ModifyID = ${ModifyID};
        `;
        await pool.request().query(updateModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Evaluation =====
router.post('/evaluation', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigEval = await pool.request().query(`SELECT row_number() over(order by a.EvalDateTime) AS Attemp, a.EvalID,
        a.EvalDateTime, a.EvalType, a.TsResult, a.CustomerResult, a.Problem,
        b.FirstName AS JigEvalBy, c.FirstName AS JigApproveBy,
        d.FirstName AS EnEvalBy, e.FirstName AS EnApproveBy,
        f.FirstName AS QaEvalBy, g.FirstName AS QaApproveBy,
        h.FirstName AS PdEvalBy, i.FirstName AS PdApproveBy,
        j.FirstName AS PeEvalBy, k.FirstName AS PeApproveBy,
        a.CustomerEval1, a.CustomerEval2
        FROM [Jig].[JigEvaluation] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.JigEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.JigApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.EnEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON e.EmployeeID = a.EnEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON f.EmployeeID = a.QaEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] g ON g.EmployeeID = a.QaApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] h ON h.EmployeeID = a.PdEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] i ON i.EmployeeID = a.PdApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] j ON j.EmployeeID = a.PeEvalBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] k ON k.EmployeeID = a.PeApproveBy
        WHERE a.JigCreationID = ${JigCreationID};
        `);
        res.json(jigEval.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/add', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let insertEval = `INSERT INTO [Jig].[JigEval](JigCreationID, EvalDateTime) VALUES(${JigCreationID}, GETDATE());`;
        await pool.request().query(insertEval);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { EvalID, EvalType, TsResult, CustomerResult, EvalTopic, Problem, Solution, ModifyDetail } = req.body;
        let updateEval = `UPDATE [Jig].[JigWorkList] SET EvalType = ${EvalType}, TsResult = ${TsResult}, CustomerResult = ${CustomerResult},
        EvalTopic = N'${EvalTopic}', Problem = N'${Problem}', Solution = N'${Solution}', ModifyDetail = N'${ModifyDetail}', Benefit = N'${Benefit}'
        WHERE EvalID = ${EvalID};
        `;
        await pool.request().query(updateEval);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/eval', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let { EvalID, EvalBy, itemNo } = req.body;
        let itemMap = { 1: 'Jig', 2: 'En', 3: 'Qa', 4: 'Pd', 5: 'Pe' };

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EvalBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signEval = `UPDATE [Jig].[JigEvaluation] SET ${itemMap[itemNo]}EvalBy = ${EvalBy}, ${itemMap[itemNo]}EvalTime = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signEval);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/approve', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let { EvalID, ApproveBy, itemNo } = req.body;
        let itemMap = { 1: 'Jig', 2: 'En', 3: 'Qa', 4: 'Pd', 5: 'Pe' };

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Jig].[JigEvaluation] SET ${itemMap[itemNo]}ApproveBy = ${ApproveBy}, ${itemMap[itemNo]}ApproveTime = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/customer', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let { EvalID, CustomerNo, CustomerName } = req.body;
        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signEval = `UPDATE [Jig].[JigEvaluation] SET Customer${CustomerNo} = N'${CustomerName}', CustomerEvalTime${CustomerNo} = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signEval);
        res.json({ message: 'Success', SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageEval = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/eval'),
    filename: (req, file, cb) => {
        let { EvalID, ImageType } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EvalID}_${ImageType}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadEval = multer({ storage: storageEval }).single('jig_eval');
router.post('/evaluation/upload', async (req, res) => { //TODO: test
    uploadEval(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/jig/eval/" + req.file.filename : "";
                let { EvalID, ImageType } = req.body;
                // ImageType = ['Problem', 'Solution', 'Before', 'After', 'Jig', 'PartList', 'Modify']
                let updateEvalImage = `UPDATE [Jig].[JigEvaluation] SET ${ImageType}Image = N'${ImagePath}' WHERE EvalID = ${EvalID};`;
                await pool.request().query(updateEvalImage);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

//* ===== Comment =====
router.post('/comment', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigComment = await pool.request().query(`SELECT a.CommentID, a.Comment, a.Fix, a.FixDateTime, a.Remark,
        b.FirstName AS FixBy
        FROM [Jig].[JigComment] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.FixBy
        WHERE a.JigCreationID = ${JigCreationID};
        `);
        res.json(jigComment.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/comment/add', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigCreationID, Comment } = req.body;
        let insertComment = `INSERT INTO [Jig].[JigComment](JigCreationID, Comment) VALUES(${JigCreationID}, N'${Comment}');`;
        await pool.request().query(insertComment);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/comment/fix', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { CommentID, FixBy, Remark } = req.body;

        // Check Employee
        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${RequestBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let updateWorkList = `UPDATE [Jig].[JigWorkList] SET Fix = 1, FixBy = N'${FixBy}', Remark = N'${Remark}' WHERE CommentID = ${CommentID};`;
        await pool.request().query(updateWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


module.exports = router;