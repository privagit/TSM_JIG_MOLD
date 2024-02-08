const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const Redis = require('ioredis');
const redis = new Redis();
const multer = require('multer');

//TODO: StartTime, EndTime == ActualTime ??
//* ========= Repair Issue =========
router.post('/repair-issue', async (req, res) => { //TODO: Status
    try {
        let pool = await sql.connect(config);
        let { month, year, Status } = req.body;

        let repairIssue = await pool.request().query(`SELECT a.RepairCheckID, b.BasicMold, b.DieNo, a.RequestTime, a.StartTime, a.EndTime, a.Complaint,
        a.RepairResult, a.ApproveBy, a.ReportNo, a.PlanStartTime
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
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
router.post('/repair-issue/dropdown/mold', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let jigs = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, a.MoldName FROM [Mold].[MasterMold] a WHERE a.Active = 1;`);
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
        FROM [Mold].[MasterRepairType] a
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
        FROM [Mold].[MasterRepairProblem] a
        WHERE a.RepairTypeID = ${RepairTypeID} AND a.Active = 1;
        `);
        res.json(problem.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Request
router.post('/repair-issue/request/issue', async (req, res) => { //TODO: Socket io., ReportNo., cache, RunningNo., io
    try {
        let pool = await sql.connect(config);
        let { MoldID, CavityStd, CavityAct, RepairTypeID, RepairProblemID, Complaint, Attachment, OccurTime, RequestBy, RequestTime, Section } = req.body;

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


        let issueRepair = await pool.request().query(`INSERT INTO [Mold].[RepairCheck](MoldID, CavityStd, CavityAct, RepairTypeID, RepairProblemID,
        Complaint, Attachment, OccurTime, RequestBy, RequestTime, Section, ReportNo)
        VALUES(${MoldID}, ${CavityStd}, ${CavityAct}, ${RepairTypeID}, ${RepairProblemID},
        N'${Complaint}', N'${Attachment}', N'${OccurTime}',
        N'${RequestBy}', '${RequestTime}', '${Section}', '${ReportNo}');

        SELECT SCOPE_IDENTITY() AS RepairCheckID;
        `);

        // io
        const io = req.app.get('socketio');
        let machine = await pool.request().query(`SELECT BasicMold, DieNo FROM [Mold].[MasterMold] WHERE MoldID = ${MoldID};`);
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        let alertLog = { MachineNo: machine.recordset[0]?.MachineNo, Module: 1, Action: 1, time: alertTime, date: alertDate };
        io.emit('mold-alert-log', alertLog);
        let cacheAlertLog = await redis.get('mold-alert-log');
        if(!cacheAlertLog){
            await redis.set('mold-alert-log', JSON.stringify([alertLog]));
        } else {
            let cur = new Date();
            let cacheAlertLogJSON = JSON.parse(cacheAlertLog);
            let cacheAlertLogFilter = cacheAlertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
            cacheAlertLogFilter.push(alertLog);
            await redis.set('mold-alert-log', JSON.stringify(cacheAlertLogFilter));
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
        let startRepair = `UPDATE [Mold].[RepairCheck] SET StartTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
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
        a.StartTime, a.EndTime, a.DetailOfRepair, a.RepairResult, a.OccurTime, a.Attachment, a.RepairImagePath,
        a.PlanStartTime, a.PlanFinishTime, a.ActualStartTime, a.ActualFinishTime, a.PlanActualArr,
        b.FirstName AS RequestBy, c.FirstName AS RepairBy, d.FirstName AS ApproveBy,
        e.FirstName AS InjCheckBy, f.FirstName AS QcCheckBy, g.FirstName AS MoldCheckBy
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.RequestBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.RepairBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.ApproveBy = d.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON a.InjCheckBy = e.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON a.QcCheckBy = f.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] g ON a.MoldCheckBy = g.EmployeeID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);
        if(repair.recordset.length){
            repair.recordset[0].RequestBy = !repair.recordset[0].RequestBy ? null: atob(repair.recordset[0].RequestBy);
            repair.recordset[0].RepairBy = !repair.recordset[0].RepairBy ? null: atob(repair.recordset[0].RepairBy);
            repair.recordset[0].ApproveBy = !repair.recordset[0].ApproveBy ? null: atob(repair.recordset[0].ApproveBy);
            repair.recordset[0].InjCheckBy = !repair.recordset[0].InjCheckBy ? null: atob(repair.recordset[0].InjCheckBy);
            repair.recordset[0].QcCheckBy = !repair.recordset[0].QcCheckBy ? null: atob(repair.recordset[0].QcCheckBy);
            repair.recordset[0].MoldCheckBy = !repair.recordset[0].MoldCheckBy ? null: atob(repair.recordset[0].MoldCheckBy);
        }
        res.json(repair.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/process', async (req, res) => { // initial Process (Plan & Actual)
    try {
        let pool = await sql.connect(config);
        let process = await pool.request().query(`SELECT ProcessID, ProcessType, Detail, CostPerHour
        FROM [Mold].[MasterProcess]
        WHERE Active = 1 AND ProcessType = 2;
        `);
        res.json(process.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/plan-actual/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, PlanStartTime, PlanFinishTime, ActualStartTime, ActualFinishTime, PlanActualArr } = req.body;
        let updateRepair = `UPDATE [Mold].[RepairCheck] SET PlanStartTime = '${PlanStartTime}', PlanFinishTime = '${PlanFinishTime}',
        ActualStartTime = '${ActualStartTime}', ActualFinishTime = '${ActualFinishTime}', PlanActualArr = '${PlanActualArr}'
        WHERE RepairCheckID = ${RepairCheckID};
        `;
        await pool.request().query(updateRepair);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/repair/detail/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, DetailOfRepair, RepairResult } = req.body;

        //RepairResult 1: Accepted, 2: Rejected, 3: Special Accept
        let updateRepair = `UPDATE [Mold].[RepairCheck] SET DetailOfRepair = N'${DetailOfRepair}', RepairResult = ${RepairResult}
        WHERE RepairCheckID = ${RepairCheckID};
        `;
        await pool.request().query(updateRepair);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageRepairImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/repair'),
    filename: (req, file, cb) => {
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${uploadDateStr}` + '.' + ext);
    }
});
const uploadRepairImage = multer({ storage: storageRepairImage }).single('repair_image');
router.post('/repair-issue/repair/image/upload', async (req, res) => {
    uploadRepairImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let { RepairCheckID } = req.body;
                let ImagePath = (req.file) ? "/mold/repair/" + req.file.filename : ""

                let updateImage = `UPDATE [Em].[RepairCheck] SET RepairImagePath = '${ImagePath}' WHERE RepairCheckID = ${RepairCheckID};`;
                await pool.request().query(updateImage);

                res.header('Access-Control-Allow-Origin', req.headers.origin);
                res.header('Access-Control-Allow-Credentials', true);
                res.status(200).send({ message: 'Success Upload File' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

// Tech
router.post('/repair-issue/repair/tech', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID } = req.body;

        let techs = await pool.request().query(`SELECT a.RepairTechID, b.FirstName AS TechName
        FROM [Mold].[RepairTech] a
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
        SELECT @CntTech = COUNT(RepairTechID) FROM [Mold].[RepairTech] WHERE EmployeeID = ${EmployeeID} AND RepairCheckID = ${RepairCheckID};

        IF(@CntTech = 0)
        BEGIN
            INSERT INTO [Mold].[RepairTech](RepairCheckID, EmployeeID) VALUES(${RepairCheckID}, ${EmployeeID});
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

        let deleteTech = `DELETE FROM [Mold].[RepairTech] WHERE RepairTechID = ${RepairTechID};`;
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
        FROM [Mold].[MasterSpareCategory] a
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
        FROM [Mold].[MasterSpare] a
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
        FROM [Mold].[RepairCost] a
        LEFT JOIN [Mold].[MasterSpare] b ON a.SpareID = b.SpareID
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
        let { RepairCheckID, SpareID, Qty, UnitPrice } = req.body;

        // Get Remain
        let getRemain = await pool.request().query(`DECLARE @BF INT,
        @Received INT,
        @Used INT,
        @Purchase INT;

        SELECT @BF = a.BF, @Received = a.Received, @Purchase = a.Purchase
        FROM [Mold].[SpareMonth] a
        WHERE MONTH(a.MonthYear) = MONTH(GETDATE()) AND YEAR(a.MonthYear) = YEAR(GETDATE()) AND a.SpareID = ${SpareID};

        SELECT @Used = SUM(a.Qty)
        FROM [Mold].[RepairCost] a
        WHERE MONTH(a.UsedDate) = MONTH(GETDATE()) AND YEAR(a.UsedDate) = YEAR(GETDATE()) AND a.SpareID = ${SpareID};

        SELECT ISNULL(@BF,0) + ISNULL(@Received,0) + ISNULL(@Purchase,0) - ISNULL(@Used,0) AS Remain;
        `);
        let remain = getRemain.recordset[0]?.Remain || 0;
        if(Qty > remain) return res.status(400).send({ message: 'คงเหลือใน Stock น้อยกว่าที่ใช้' });


        let insertPart = `INSERT [Mold].[RepairCost](RepairCheckID, SpareID, Qty, UnitPrice, UsedDate)
        VALUES(${RepairCheckID}, ${SpareID}, ${Qty}, ${UnitPrice}, GETDATE());
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

        let deletePart = `DELETE FROM [Mold].[RepairCost] WHERE RepairCostID = ${RepairCostID};`;
        await pool.request().query(deletePart);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Sign
router.post('/repair-issue/sign/repair', async (req, res) => { //TODO: socket io. cache, io
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, RepairBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${RepairBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[RepairCheck] SET RepairBy = ${RepairBy}, EndTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRepair);

        // Socket io
        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let machine = await pool.request().query(`SELECT b.BasicMold, b.DieNo
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
        WHERE a.RepairCheckID = ${RepairCheckID};
        `);
        let alertLog = { BasicMold: machine.recordset[0]?.BasicMold, Module: 1, Action: 2, time: alertTime, date: alertDate }
        io.emit('mold-alert-log', alertLog);
        let cacheAlertLog = await redis.get('mold-alert-log');
        if(!cacheAlertLog){
            await redis.set('mold-alert-log', JSON.stringify([alertLog]));
        } else {
            let cur = new Date();
            let cacheAlertLogJSON = JSON.parse(cacheAlertLog);
            let cacheAlertLogFilter = cacheAlertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
            cacheAlertLogFilter.push(alertLog);
            await redis.set('mold-alert-log', JSON.stringify(cacheAlertLogFilter));
        }

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), EndTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRequest = `UPDATE [Mold].[RepairCheck] SET CheckBy = ${CheckBy}, CheckTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRequest);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
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
        let signRequest = `UPDATE [Mold].[RepairCheck] SET ApproveBy = ${ApproveBy}, ApproveTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRequest);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/injection', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, InjCheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${InjCheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRequest = `UPDATE [Mold].[RepairCheck] SET InjCheckBy = ${InjCheckBy}, InjCheckTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRequest);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/qc', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, QcCheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${QcCheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[RepairCheck] SET QcCheckBy = ${QcCheckBy}, QcCheckTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair-issue/sign/mold', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairCheckID, MoldCheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${MoldCheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[RepairCheck] SET MoldCheckBy = ${MoldCheckBy}, MoldCheckTime = '${curStr}' WHERE RepairCheckID = ${RepairCheckID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;