const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const multer = require('multer');
const path = require('path');
const { getPool } = require('../../middlewares/pool-manager');


//* ========== Jig Creation ==========
router.post('/list', async (req, res) => { //TODO: JigNo
    try {
        let pool = await getPool('JigPool', config);
        let { RequestSection, Status } = req.body;

        //TODO: where
        let jigCreateList = await pool.request().query(`SELECT a.JigCreationID, NULL AS JigNo, a.CustomerID, b.CustomerName, a.PartCode, a.PartName, a.RequestSection, 
        CONVERT(NVARCHAR, a.RequestTime, 23) AS RequestDate, CONVERT(NVARCHAR, a.RequiredDate, 23) AS RequiredDate,
        a.Quantity, a.JigTypeID, c.JigType, a.RequestType, a.Budget, a.CustomerBudget,
        d.FirstName AS PartListApproveBy, a.PartListApproveSignTime, a.ExamResult, a.ExamApproveBy, CONVERT(NVARCHAR, a.FinishDate, 23) AS FinishDate
        FROM [Jig].[JigCreation] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Jig].[MasterJigType] c ON c.JigTypeID = a.JigTypeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.PartListApproveBy = d.EmployeeID
        `);
        let jigPartList = await pool.request().query(`SELECT a.JigCreationID, COUNT(a.PartListID) AS CntPartList,
        COUNT(CASE WHEN a.Received = 1 THEN a.PartListID ELSE 0 END) AS CntReceived
        FROM [Jig].[JigPartList] a
        GROUP BY a.JigCreationID;
        `);
        let jigTrial = await pool.request().query(`SELECT a.JigCreationID, COUNT(a.TrialID) AS TrialCount
        FROM [Jig].[JigTrial] a
        GROUP BY a.JigCreationID;
        `);
        //TODO: Where
        let jigEval = await pool.request().query(`SELECT a.EvalID, a.JigCreationID
        FROM [Jig].[JigEvaluation] a
        WHERE a.TsResult = 1 AND a.CustomerResult = 1;
        `);

        for (let item of jigCreateList.recordset) {
            item.PartListApproveBy = !item.PartListApproveBy ? null : atob(item.PartListApproveBy);

            // Request Status { 0: Issue, 1: Accept (Wait Approve), 2: Accept, 3: Reject }
            if (item.ExamResult == null) {
                item.RequestStatus = 0; // Issue
            } else if (item.ExamResult == 1) {
                if (!item.ExamApproveBy) {
                    item.RequestStatus = 1; // Accept (Wait Approve)
                } else {
                    item.RequestStatus = 2; // Accept
                }
            } else if (item.ExamResult == 0) {
                item.RequestStatus = 3; // Reject
            }
            // Trial Count
            let trialFiltered = jigTrial.recordset.filter(v => v.JigCreationID == item.JigCreationID);
            if (trialFiltered.length) {
                item.TrialCount = trialFiltered[0].TrialCount;
            } else {
                item.TrialCount = 0;
            }

            // Eval Status { 0: -, 1: Pass }
            let evalFiltered = jigEval.recordset.filter(v => v.JigCreationID == item.JigCreationID);
            if (!evalFiltered.length) {
                item.EvalStatus = 0; // no Eval
            } else {
                item.EvalStatus = 1; // Pass
            }

            // PartList Status { 0: null, 1: Issue, 2: Wait Approve, 3: Complete }
            if (item.PartListApproveBy) {
                item.PartListStatus = 3; // complete
                continue;
            }
            let partListFiltered = jigPartList.recordset.filter(v => v.JigCreationID == item.JigCreationID);
            if (!partListFiltered.length) {
                item.PartListStatus = 0; // no part list
                continue;
            }
            if (partListFiltered[0].CntPartList == partListFiltered[0].CntReceived) {
                item.PartListStatus = 2; // complete
            } else {
                item.PartListStatus = 1; // issue
            }
        }

        res.json(jigCreateList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageJigRequestImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/request'),
    filename: (req, file, cb) => {
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${uploadDateStr}` + '.' + ext);
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
                let pool = await getPool('JigPool', config);
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
router.post('/request', async (req, res) => { //TODO: JigNo
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigRequest = await pool.request().query(`SELECT a.JigCreationID, a.JlNo, a.CustomerID, a.JigTypeID, a.PartCode, a.PartName, a.Quantity, a.RequiredDate,
        a.RequestTime, a.RequestSection, a.RequestType, a.ProductionDate, a.Budget, a.CustomerBudget, a.FgMonthQty, a.FgYearQty,
        a.UseIn, a.Requirement, a.RequestImagePath, a.ConfirmDateResult, a.ConfirmDate, a.ExamResult, a.Reason, a.Project,
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
        for (let item of jigRequest.recordset) {
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
        let pool = await getPool('JigPool', config);
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
        let pool = await getPool('JigPool', config);
        let { JigCreationID, ExamResult, Reason, Project } = req.body;
        let updateConfirmTarget = `UPDATE [Jig].[JigCreation] SET ExamResult = ${ExamResult}, Reason = N'${Reason}', Project = N'${Project}'
        WHERE JigCreationID = ${JigCreationID};
        `;
        await pool.request().query(updateConfirmTarget);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/request/sign', async (req, res) => { // ต้องอนุมัติก่อนถึงจะ Sign Exam ได้
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, EmployeeID, itemNo } = req.body;
        let itemMap = { 1: 'Responsible', 2: 'Request', 3: 'Checked', 4: 'Approve', 5: 'ExamRequest', 6: 'ExamChecked', 7: 'ExamApprove' };

        if (itemNo == 5 || itemNo == 6 || itemNo == 7) { // Check ExamResult ต้องอนุมัติก่อนถึงจะ Sign Exam ได้
            let getExamResult = await pool.request().query(`SELECT ExamResult FROM [Jig].[JigCreation] WHERE JigCreationID = ${JigCreationID};`);
            if (!getExamResult.recordset[0].ExamResult) return res.status(400).send({ message: 'ไม่สามารถลงชื่อได้ ต้องทำการอนุมัติก่อน' });
        }

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });


        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).slice(-2)}-${('00' + cur.getDate()).slice(-2)} ${('00' + cur.getHours()).slice(-2)}:${('00' + cur.getMinutes()).slice(-2)}`;
        if (itemNo == 1) { // responsible
            let signResponsible = `UPDATE [Jig].[JigCreation] SET ResponsibleBy = ${EmployeeID} WHERE JigCreationID = ${JigCreationID};`;
            await pool.request().query(signResponsible);
        } else { // request, check, approve
            let signResponsible = `UPDATE [Jig].[JigCreation] SET ${itemMap[itemNo]}By = ${EmployeeID}, ${itemMap[itemNo]}SignTime = '${curStr}'  WHERE JigCreationID = ${JigCreationID};`;
            await pool.request().query(signResponsible);
        }

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Part List =====
router.post('/part-list', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigPartList = await pool.request().query(`SELECT row_number() over(order by a.PartListID) AS ItemNo,
        a.PartListID, a.List, a.Qty, a.OrderType, a.Remark, a.Received, b.AxCode, a.UnitPrice
        FROM [Jig].[JigPartList] a
        LEFT JOIN [Jig].[MasterSpare] b ON b.SpareID = a.SpareID
        WHERE a.JigCreationID = ${JigCreationID} AND a.Active = 1;
        `);
        for (let item of jigPartList.recordset) {
            item.Amount = Math.round(item.Qty * item.UnitPrice * 100) / 100;
        }
        res.json(jigPartList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/part-list/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, List, Qty, OrderType, Remark, SpareID, UnitPrice } = req.body;

        let insertPartList = `INSERT INTO [Jig].[JigPartList](JigCreationID, List, Qty, OrderType, Remark, SpareID, UnitPrice, Active)
        VALUES(${JigCreationID}, N'${List}', ${Qty}, ${OrderType}, N'${Remark}', ${SpareID}, ${UnitPrice}, 1);
        `;
        await pool.request().query(insertPartList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/part-list/received', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PartListID, Received } = req.body;

        let updatePartListReceived = `UPDATE [Jig].[JigPartList] SET Received = ${Received} WHERE PartListID = ${PartListID};
        `;
        await pool.request().query(updatePartListReceived);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/part-list/delete', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PartListID } = req.body;

        let deletePartList = `UPDATE [Jig].[JigPartList] SET Active = 0 WHERE PartListID = ${PartListID};
        `;
        await pool.request().query(deletePartList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/part-list/sign/approve', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, PartListApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${PartListApproveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Jig].[JigCreation] SET PartListApproveBy = ${PartListApproveBy}, PartListApproveSignTime = GETDATE() WHERE JigCreationID = ${JigCreationID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Work List =====
router.post('/work-list', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigWorkList = await pool.request().query(`SELECT row_number() over(order by a.WorkListID) AS ItemNo,
        a.WorkListID, a.WorkType, a.StartTime, a.FinishTime, a.Detail, a.Responsible, a.Remark
        FROM [Jig].[JigWorkList] a
        WHERE a.JigCreationID = ${JigCreationID} AND Active = 1;
        `);
        res.json(jigWorkList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/work-list/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, WorkType, StartTime, FinishTime, Detail, Responsible, Remark } = req.body;
        let insertWorkList = `INSERT INTO [Jig].[JigWorkList](JigCreationID, WorkType, StartTime, FinishTime, Detail, Responsible, Remark, Active)
        VALUES(${JigCreationID}, N'${WorkType}', '${StartTime}', '${FinishTime}', N'${Detail}', N'${Responsible}', N'${Remark}', 1);
        `;
        await pool.request().query(insertWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/work-list/edit', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
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
router.delete('/work-list/delete', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
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
router.post('/modify', async (req, res) => { // Budget ดูจาก JigCreation
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigModify = await pool.request().query(`SELECT a.ModifyID, a.JigCreationID, a.ModifyNo, a.ModifyDate, a.Responsible,
        a.Problem, a.Solution, a.Detail, a.Benefit, a.Cost, a.BeforeImagePath, a.AfterImagePath, b.Budget, b.CustomerBudget
        FROM [Jig].[JigModify] a
        LEFT JOIN [Jig].[JigCreation] b ON b.JigCreationID = a.JigCreationID
        WHERE a.JigCreationID = ${JigCreationID}
        ORDER BY ModifyNo;
        `);
        res.json(jigModify.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/modify/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let insertModify = `INSERT INTO [Jig].[JigModify](JigCreationID) VALUES(${JigCreationID});`;
        await pool.request().query(insertModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/modify/edit', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ModifyID, ModifyNo, ModifyDate, Responsible, Problem, Solution, Detail, Benefit, Cost } = req.body;
        let updateModify = `UPDATE [Jig].[JigModify] SET ModifyNo = ${ModifyNo}, ModifyDate = '${ModifyDate}', Responsible = N'${Responsible}',
        Problem = N'${Problem}', Solution = N'${Solution}', Detail = N'${Detail}', Benefit = N'${Benefit}', Cost = N'${Cost}'
        WHERE ModifyID = ${ModifyID};
        `;
        await pool.request().query(updateModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// รายละเอียดวัสดุ / ค่าใช้จ่ายอื่นๆ
router.post('/modify/part-list', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ModifyID } = req.body;
        let modifyPartList = await pool.request().query(`SELECT row_number() over(order by a.ModifyPartListID) AS ItemNo, a.ModifyPartListID,
        a.List, a.Qty, a.OrderType, a.Remark, a.Received, b.AxCode, a.UnitPrice
        FROM [Jig].[JigModifyPartList] a
        LEFT JOIN [Jig].[MasterSpare] b ON b.SpareID = a.SpareID
        WHERE a.ModifyID = ${ModifyID} AND a.Active = 1;
        `);
        res.json(modifyPartList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/modify/part-list/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let insertModify = `INSERT INTO [Jig].[JigModify](JigCreationID) VALUES(${JigCreationID});`;
        await pool.request().query(insertModify);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/modify/part-list/delete', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ModifyID, ModifyNo, ModifyDate, Responsible, Problem, Solution, Detail, Benefit, Cost } = req.body;
        let updateModify = `UPDATE [Jig].[JigModify] SET ModifyNo = ${ModifyNo}, ModifyDate = '${ModifyDate}', Responsible = N'${Responsible}',
        Problem = N'${Problem}', Solution = N'${Solution}', Detail = N'${Detail}', Benefit = N'${Benefit}', Cost = N'${Cost}'
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
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
                let pool = await getPool('JigPool', config);
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
                let pool = await getPool('JigPool', config);
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


//* ===== Trial =====
router.post('/trial', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigTrial = await pool.request().query(`SELECT row_number() over(order by a.TrialID) AS Attempt,
        a.TrialID, CONVERT(NVARCHAR, a.PlanStart, 23) AS TestDate, a.Qty,
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
router.post('/trial/add', async (req, res) => { // ต้อง Receive PartList ให้ครบก่อน
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;

        let getPartList = await pool.request().query(`SELECT a.PartListID
        FROM [Jig].[JigPartList] a
        WHERE Received = 0 AND a.JigCreationID = 1;
        `);
        if (getPartList.recordset.length) return res.status(400).send({ message: 'มี PartList ยังไม่ถูก Receive' });


        let insertTrial = `INSERT INTO [Jig].[JigTrial](JigCreationID) VALUES(${JigCreationID});`;
        await pool.request().query(insertTrial);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/trial/edit', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { TrialID, PlanStart, PlanFinish, ActualStart, ActualFinish, Qty, Problem, Reason, FixDetail, Remark } = req.body;
        let updateTrial = `UPDATE [Jig].[JigTrial] SET PlanStart = '${PlanStart}', PlanFinish = '${PlanFinish}', ActualStart = '${ActualStart}',
        ActualFinish = '${ActualFinish}', Qty = ${Qty}, Problem = N'${Problem}', Reason = N'${Reason}', FixDetail = N'${FixDetail}', Remark = N'${Remark}'
        WHERE TrialID = ${TrialID};
        `;
        await pool.request().query(updateTrial);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Evaluation =====
router.post('/evaluation', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigEval = await pool.request().query(`SELECT row_number() over(order by a.EvalDateTime) AS Attempt, a.EvalID,
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
        for (let item of jigEval.recordset) {
            item.JigEvalBy = !item.JigEvalBy ? null : atob(item.JigEvalBy);
            item.JigApproveBy = !item.JigApproveBy ? null : atob(item.JigApproveBy);
            item.EnEvalBy = !item.EnEvalBy ? null : atob(item.EnEvalBy);
            item.EnApproveBy = !item.EnApproveBy ? null : atob(item.EnApproveBy);
            item.QaEvalBy = !item.QaEvalBy ? null : atob(item.QaEvalBy);
            item.QaApproveBy = !item.QaApproveBy ? null : atob(item.QaApproveBy);
            item.PdEvalBy = !item.PdEvalBy ? null : atob(item.PdEvalBy);
            item.PdApproveBy = !item.PdApproveBy ? null : atob(item.PdApproveBy);
            item.PeEvalBy = !item.PeEvalBy ? null : atob(item.PeEvalBy);
            item.PeApproveBy = !item.PeApproveBy ? null : atob(item.PeApproveBy);
        }
        res.json(jigEval.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/item', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { EvalID } = req.body;
        let jigEval = await pool.request().query(`SELECT row_number() over(order by a.EvalDateTime) AS Attempt, a.EvalID,
        a.EvalDateTime, a.EvalType, a.TsResult, a.CustomerResult, a.Problem, a.EvalTopic,
        a.Solution, a.ModifyDetail,
        a.JigEvalTime, a.EnEvalTime, a.QaEvalTime, a.PdEvalTime, a.PeEvalTime,
        a.JigApproveTime, a.EnApproveTime, a.QaApproveTime, a.PdApproveTime, a.PeApproveTime,
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
        WHERE a.EvalID = ${EvalID};
        `);
        for (let item of jigEval.recordset) {
            item.JigEvalBy = !item.JigEvalBy ? null : atob(item.JigEvalBy);
            item.JigApproveBy = !item.JigApproveBy ? null : atob(item.JigApproveBy);
            item.EnEvalBy = !item.EnEvalBy ? null : atob(item.EnEvalBy);
            item.EnApproveBy = !item.EnApproveBy ? null : atob(item.EnApproveBy);
            item.QaEvalBy = !item.QaEvalBy ? null : atob(item.QaEvalBy);
            item.QaApproveBy = !item.QaApproveBy ? null : atob(item.QaApproveBy);
            item.PdEvalBy = !item.PdEvalBy ? null : atob(item.PdEvalBy);
            item.PdApproveBy = !item.PdApproveBy ? null : atob(item.PdApproveBy);
            item.PeEvalBy = !item.PeEvalBy ? null : atob(item.PeEvalBy);
            item.PeApproveBy = !item.PeApproveBy ? null : atob(item.PeApproveBy);
        }
        res.json(jigEval.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/add', async (req, res) => { //TODO: บล็อคตอนที่มี Pass แล้ว (Pass อันไหนบ้าง)
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let insertEval = `INSERT INTO [Jig].[JigEvaluation](JigCreationID, EvalDateTime) VALUES(${JigCreationID}, GETDATE());`;
        await pool.request().query(insertEval);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/edit', async (req, res) => { // Comment ต้อง Fix ให้หมดถึงจผ่านได้
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, EvalID, EvalType, TsResult, CustomerResult, EvalTopic, Problem, Solution, ModifyDetail } = req.body;

        let getUnfixComment = await pool.request().query(`SELECT a.CommentID FROM [Jig].[JigComment] a
        WHERE JigCreationID = ${JigCreationID} AND (a.Fix = 0 OR a.Fix IS NULL);
        `);
        if (getUnfixComment.recordset.length) return res.status(400).send({ message: 'ไม่สามารถบันทึกผลได้ มี Comment ยังไม่ถูก Fix' });
        let updateEval = `UPDATE [Jig].[JigEvaluation] SET EvalType = ${EvalType}, TsResult = ${TsResult}, CustomerResult = ${CustomerResult},
        EvalTopic = N'${EvalTopic}', Problem = N'${Problem}', Solution = N'${Solution}', ModifyDetail = N'${ModifyDetail}'
        WHERE EvalID = ${EvalID};
        `;
        await pool.request().query(updateEval);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/eval', async (req, res) => { //TODO: finish
    try {
        let pool = await getPool('JigPool', config);
        let { EvalID, EvalBy, itemNo } = req.body;
        let itemMap = { 1: 'Jig', 2: 'En', 3: 'Qa', 4: 'Pd', 5: 'Pe' };

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EvalBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signEval = `UPDATE [Jig].[JigEvaluation] SET ${itemMap[itemNo]}EvalBy = ${EvalBy}, ${itemMap[itemNo]}EvalTime = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signEval);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/approve', async (req, res) => { //TODO: finish
    try {
        let pool = await getPool('JigPool', config);
        let { EvalID, ApproveBy, itemNo } = req.body;
        let itemMap = { 1: 'Jig', 2: 'En', 3: 'Qa', 4: 'Pd', 5: 'Pe' };
        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Jig].[JigEvaluation] SET ${itemMap[itemNo]}ApproveBy = ${ApproveBy}, ${itemMap[itemNo]}ApproveTime = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/sign/customer', async (req, res) => { // TODO: finish
    try {
        let pool = await getPool('JigPool', config);
        let { EvalID, CustomerNo, CustomerName } = req.body;
        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signEval = `UPDATE [Jig].[JigEvaluation] SET CustomerEval${CustomerNo} = N'${CustomerName}', CustomerEvalTime${CustomerNo} = GETDATE() WHERE EvalID = ${EvalID};`;
        await pool.request().query(signEval);
        res.json({ message: 'Success', SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/topic', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let evalTopic = await pool.request().query(`SELECT EvalTopicID, EvalTopic
        FROM [Jig].[MasterEvalTopic]
        WHERE Active = 1;
        `);
        let evalDetail = await pool.request().query(`SELECT EvalDetailID, EvalTopicID, EvalDetail
        FROM [Jig].[MasterEvalDetail]
        WHERE Active = 1;
        `);
        let evalCriteria = await pool.request().query(`SELECT EvalCriteriaID, EvalDetailID, EvalCriteria
        FROM [Jig].[MasterEvalCriteria]
        WHERE Active = 1;
        `);
        for (let topic of evalTopic.recordset) {
            let rowSpan = 0;
            let detailFiltered = evalDetail.recordset.filter(detail => detail.EvalTopicID == topic.EvalTopicID);
            for (let detail of detailFiltered) {
                let criteriaFiltered = evalCriteria.recordset.filter(criteria => criteria.EvalDetailID == detail.EvalDetailID);
                if (!criteriaFiltered.length) {
                    detail.Criteria = []; // no criteria
                    rowSpan += 1;
                } else {
                    detail.Criteria = criteriaFiltered; // has criteria
                    rowSpan += criteriaFiltered.length;
                }
            }
            if (!detailFiltered.length) {
                topic.Detail = []; // no detail
                rowSpan += 1;
            } else {
                topic.Detail = detailFiltered; // has detail
            }
            topic.rowSpan = rowSpan;
        }
        res.json(evalTopic.recordset);
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EvalID}_${ImageType}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadEval = multer({ storage: storageEval }).single('jig_eval');
router.post('/evaluation/upload', async (req, res) => {
    uploadEval(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await getPool('JigPool', config);
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
router.post('/comment', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID } = req.body;
        let jigComment = await pool.request().query(`SELECT row_number() over(order by a.CommentID) AS ItemNo,
        a.CommentID, a.Comment, a.Fix, a.FixDateTime, a.Remark,
        b.FirstName AS FixBy
        FROM [Jig].[JigComment] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.FixBy
        WHERE a.JigCreationID = ${JigCreationID};
        `);
        for (let item of jigComment.recordset) {
            item.FixBy = !item.FixBy ? null : atob(item.FixBy);
        }
        res.json(jigComment.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/comment/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigCreationID, Comment } = req.body;
        let insertComment = `INSERT INTO [Jig].[JigComment](JigCreationID, Comment) VALUES(${JigCreationID}, N'${Comment}');`;
        await pool.request().query(insertComment);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/comment/fix', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { CommentID, FixBy, Remark } = req.body;

        // Check Employee
        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${FixBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let updateWorkList = `UPDATE [Jig].[JigComment] SET Fix = 1, FixBy = ${FixBy}, Remark = N'${Remark}', FixDateTime = GETDATE() WHERE CommentID = ${CommentID};`;
        await pool.request().query(updateWorkList);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


module.exports = router;