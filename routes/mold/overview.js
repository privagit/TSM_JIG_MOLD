const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const Redis = require('ioredis');
const redis = new Redis();
const { getPool } = require('../../middlewares/pool-manager');


//* ========= overview ==========
router.post('/plan', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldTypeID, Section, PlanFilter,  } = req.body;

        // PlanFilter 1: All Plan, 2: Today Plan
        if(PlanFilter == 1){ // All Plan
            var plans = await pool.request().query(`WITH PlanType1 AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY a.PlanStartTime DESC) AS RowNum,
                a.PmPlanID, a.MoldID, a.PlanStartTime, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Mold].[PmPlan] a
                WHERE a.PmType = 1
            ), PlanType2 AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY a.PlanStartTime DESC) AS RowNum,
                a.PmPlanID, a.MoldID, a.PlanStartTime, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Mold].[PmPlan] a
                WHERE a.PmType = 2
            ), Repair AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY b.PlanStartTime DESC) AS RowNum,
                b.RepairPlanID, a.MoldID, b.PlanStartTime, a.StartTime, a.EndTime, a.ReportNo
                FROM [Mold].[RepairCheck] a
                LEFT JOIN [Mold].[RepairPlan] b ON b.RepairCheckID = a.RepairCheckID
            )
            SELECT a.MoldID, a.BasicMold, a.DieNo,
            b.PmPlanID AS PmPlanID1, b.PlanStartTime AS PlanStartTime1, b.PmStart AS PmStart1, b.PmEnd AS PmEnd1, b.PmPlanNo AS PmPlanNo1,
            CASE
                WHEN b.PmEnd IS NOT NULL AND DATEDIFF(DAY, b.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN b.PmEnd IS NOT NULL AND DATEDIFF(DAY, b.PmEnd, GETDATE()) < 7 THEN 3
                WHEN b.PmEnd IS NULL AND b.PlanStartTime > GETDATE() THEN 2
                WHEN b.PmEnd IS NULL AND b.PlanStartTime < GETDATE() THEN 4
            END AS Status1,
            c.PmPlanID AS PmPlanID2, c.PlanStartTime AS PlanStartTime2, c.PmStart AS PmStart2, c.PmEnd AS PmEnd2, c.PmPlanNo AS PmPlanNo2,
            CASE
                WHEN c.PmEnd IS NOT NULL AND DATEDIFF(DAY, c.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN c.PmEnd IS NOT NULL AND DATEDIFF(DAY, c.PmEnd, GETDATE()) < 7 THEN 3
                WHEN c.PmEnd IS NULL AND c.PlanStartTime > GETDATE() THEN 2
                WHEN c.PmEnd IS NULL AND c.PlanStartTime < GETDATE() THEN 4
            END AS Status2,
            d.RepairPlanID, d.PlanStartTime AS RepairPlanStartTime, d.StartTime AS RepairStartTime, d.EndTime AS RepairEndTime, d.ReportNo AS RepairReportNo,
            CASE
                WHEN d.EndTime IS NOT NULL AND DATEDIFF(DAY, d.EndTime, GETDATE()) >= 7 THEN 1
                WHEN d.EndTime IS NOT NULL AND DATEDIFF(DAY, d.EndTime, GETDATE()) < 7 THEN 3
                WHEN d.EndTime IS NULL AND d.PlanStartTime > GETDATE() THEN 2
                WHEN d.EndTime IS NULL AND d.PlanStartTime < GETDATE() THEN 4
            END AS RepairStatus
            FROM [Mold].[MasterMold] a
            LEFT JOIN [PlanType1] b ON b.MoldID = a.MoldID AND b.RowNum = 1 
            LEFT JOIN [PlanType2] c ON c.MoldID = a.MoldID AND c.RowNum = 1
            LEFT JOIN [Repair] d ON d.MoldID = a.MoldID AND d. RowNum = 1
            `);
        } else{ //TODO: Today Plan
            var plans = await pool.request().query(`WITH PlanType1 AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY a.PlanStartTime DESC) AS RowNum,
                a.PmPlanID, a.MoldID, a.PlanStartTime, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Mold].[PmPlan] a
                WHERE a.PmType = 1
            ), PlanType2 AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY a.PlanStartTime DESC) AS RowNum,
                a.PmPlanID, a.MoldID, a.PlanStartTime, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Mold].[PmPlan] a
                WHERE a.PmType = 2
            ), Repair AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY b.PlanStartTime DESC) AS RowNum,
                b.RepairPlanID, a.MoldID, b.PlanStartTime, a.StartTime, a.EndTime, a.ReportNo
                FROM [Mold].[RepairCheck] a
                LEFT JOIN [Mold].[RepairPlan] b ON b.RepairCheckID = a.RepairCheckID
            )
            SELECT a.MoldID, a.BasicMold, a.DieNo,
            b.PmPlanID AS PmPlanID1, b.PlanStartTime AS PlanStartTime1, b.PmStart AS PmStart1, b.PmEnd AS PmEnd1, b.PmPlanNo AS PmPlanNo1,
            CASE
                WHEN b.PmEnd IS NOT NULL AND DATEDIFF(DAY, b.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN b.PmEnd IS NOT NULL AND DATEDIFF(DAY, b.PmEnd, GETDATE()) < 7 THEN 3
                WHEN b.PmEnd IS NULL AND b.PlanStartTime > GETDATE() THEN 2
                WHEN b.PmEnd IS NULL AND b.PlanStartTime < GETDATE() THEN 4
            END AS Status1,
            c.PmPlanID AS PmPlanID2, c.PlanStartTime AS PlanStartTime2, c.PmStart AS PmStart2, c.PmEnd AS PmEnd2, c.PmPlanNo AS PmPlanNo2,
            CASE
                WHEN c.PmEnd IS NOT NULL AND DATEDIFF(DAY, c.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN c.PmEnd IS NOT NULL AND DATEDIFF(DAY, c.PmEnd, GETDATE()) < 7 THEN 3
                WHEN c.PmEnd IS NULL AND c.PlanStartTime > GETDATE() THEN 2
                WHEN c.PmEnd IS NULL AND c.PlanStartTime < GETDATE() THEN 4
            END AS Status2,
            d.RepairPlanID, d.PlanStartTime AS RepairPlanStartTime, d.StartTime AS RepairStartTime, d.EndTime AS RepairEndTime, d.ReportNo AS RepairReportNo,
            CASE
                WHEN d.EndTime IS NOT NULL AND DATEDIFF(DAY, d.EndTime, GETDATE()) >= 7 THEN 1
                WHEN d.EndTime IS NOT NULL AND DATEDIFF(DAY, d.EndTime, GETDATE()) < 7 THEN 3
                WHEN d.EndTime IS NULL AND d.PlanStartTime > GETDATE() THEN 2
                WHEN d.EndTime IS NULL AND d.PlanStartTime < GETDATE() THEN 4
            END AS RepairStatus
            FROM [Mold].[MasterMold] a
            LEFT JOIN [PlanType1] b ON b.MoldID = a.MoldID AND b.RowNum = 1 
            LEFT JOIN [PlanType2] c ON c.MoldID = a.MoldID AND c.RowNum = 1
            LEFT JOIN [Repair] d ON d.MoldID = a.MoldID AND d. RowNum = 1
            `);
        }
        await Promise.all(plans.recordset.map(async v => { //TODO:
            // PmStatus { 1: เทา, 2: แดง, 3: เขียว, 4: เหลือง }
            v.PmPlan = (v.PmStatus == 2 || v.PmStatus == 3 || v.PmStatus == 4) ? v.PlanDate : null;
            v.PmPlan = v.PmStatus == 3 ? v.PmResult : null;
        }));

        res.json(plans.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/mold/detail', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        var detail = await pool.request().query(`SELECT b.CustomerName, a.BasicMold, a.DieNo, a.MoldName, a.Cavity, c.PartCode
        FROM [Mold].[MasterMold] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Mold].[Specification] c ON c.MoldSpecID = a.MoldSpecID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(detail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/pm/history', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        var historys = await pool.request().query(`SELECT a.PlanStartTime, a.PmStart, a.PmPlanID, a.PmPlanNo, b.RepairCheckID
        FROM [Mold].[PmPlan] a
        LEFT JOIN [Mold].[RepairCheck] b ON b.PmPlanID = a.PmPlanID
        WHERE a.MoldID = ${MoldID} AND a.PmEnd IS NOT NULL
        ORDER BY a.PmStart DESC;
        `);
        res.json(historys.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/data', async (req, res) => { //TODO: Type, MoldLife Shot, PmShot, TotalShot
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;

        res.json(pm.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/start', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID } = req.body;
        let startPredict = `UPDATE [Mold].[PmPlan] SET PmStart = GETDATE() WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(startPredict);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/topic', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let pm = await pool.request().query(`SELECT PmID, PmTopic, ImagePath FROM [Mold].[MasterPm] WHERE MoldID = ${MoldID};`);
        let PmID = pm.recordset[0]?.PmID;
        if(!PmID) return res.status(400).send({ message: 'กรุณาตั้งค่า PM Topic ที่หน้า Setting ก่อน' });

        let topicId = JSON.parse(pm.recordset[0].PmTopic);
        if(topicId.length){
            let topics = await pool.request().query(`SELECT InspectionID, Detail, Description
            FROM [Mold].[MasterInspectionDetail]
            WHERE InspectionID IN (${topicId.join(',')}) AND Active = 1;
            `);
            pm.recordset[0].PmTopic = topics.recordset;
        } else{
            pm.recordset[0].PmTopic = [];
        }

        res.json(pm.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/checksheet', async (req, res) => { //TODO:
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID } = req.body;
        var checksheet = await pool.request().query(`SELECT a.PmPlanID, a.PmStart, a.PmEnd, a.PmResult, a.MoldStatus, a.PmPlanNo, a.Remark,
        b.FirstName AS ConfirmBy, a.ConfirmTime, c.FirstName AS ApproveBy, a.ApproveTime,
        d.FirstName AS InspectBy, a.InspectTime, e.RepairCheckID
        FROM [Mold].[PmPlan] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.ConfirmBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.ApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.InspectBy
        LEFT JOIN [Mold].[RepairCheck] e ON e.PmPlanID = a.PmPlanID
        WHERE a.PmPlanID = ${PmPlanID};
        `);
        if(checksheet.recordset.length){
            checksheet.recordset[0].ConfirmBy = atob(checksheet.recordset[0].ConfirmBy || '');
            checksheet.recordset[0].ApproveBy = atob(checksheet.recordset[0].ApproveBy || '');
            checksheet.recordset[0].InspectBy = atob(checksheet.recordset[0].InspectBy || '');
        }
        res.json(checksheet.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/checksheet/edit', async (req, res) => { //TODO:
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID, PmResult, MoldStatus, Remark } = req.body;
        let updateChecksheet = `UPDATE [Mold].[PmPlan] SET PmResult = N'${PmResult}', MoldStatus = ${MoldStatus}, Remark = N'${Remark}' WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(updateChecksheet);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/sign', async (req, res) => { // if Tech update stop time
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID, ItemNo, EmployeeID } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        // Sign
        let ItemMap = { 1: 'Tech', 2: 'SrTech', 3: 'FinalCheck', 4: 'FinalApprove' };
        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let timeStr = `, ${ItemMap[ItemNo]}Time = '${curStr}'`;
        let pmEndStr = ItemNo == 1 ? `, PmEnd = '${curStr}'` : '';
        var sign = `UPDATE [Mold].[PmPlan] SET ${ItemMap[ItemNo]}By = ${EmployeeID} ${timeStr} ${pmEndStr} WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(sign);

        // io
        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let mold = await pool.request().query(`SELECT b.BasicMold, b.DieNo
        FROM [Mold].[PmPlan] a
        LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
        WHERE a.PmPlanID = ${PmPlanID};
        `);
        let alertLog = { MoldNo: `${mold.recordset[0].BasicMold}(${mold.recordset[0].DieNo})`, Module: 2, Action: 3, time: alertTime, date: alertDate }
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

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


router.post('/technician', async (req, res) => { //TODO PM, Repair ?
    try {
        let pool = await getPool('MoldPool', config);
        let maintenance = await pool.request().query(`WITH cte AS (
            SELECT b.UserID, b.FirstName, b.LastName,
            COUNT(a.RepairCheckID) AS CntYear,
            COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END) AS CntMonth,
            d.PositionName
            FROM [Mold].[RepairCheck] a
            INNER JOIN [TSMolymer_F].[dbo].[User] b ON a.RepairBy = b.EmployeeID
            LEFT JOIN [Mold].[MasterTechnician] c ON b.UserID = c.UserID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterPosition] d ON b.PositionID = d.PositionID
            WHERE YEAR(a.RequestTime) = YEAR(GETDATE())
            GROUP BY b.UserID, b.FirstName, b.LastName, d.PositionName
        ), cte2 AS (
            SELECT COUNT(a.RepairCheckID) AS totalYear,
            COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END) AS totalMonth
            FROM [Mold].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = YEAR(GETDATE())
        )
        SELECT a.UserID, a.FirstName, a.LastName, a.PositionName, b.ImagePath, b.SkillScore, a.CntMonth, a.CntYear,
        c.totalMonth, c.totalYear
        FROM [cte] a
        LEFT JOIN [Mold].[MasterTechnician] b ON a.UserID = b.UserID
        CROSS JOIN [cte2] c
        `);

        let PM_Month = maintenance.recordset[0]?.totalMonth || 0;
        let PM_Year = maintenance.recordset[0]?.totalYear || 0;
        for(let item of maintenance.recordset){
            item.name = `${atob(item.FirstName)} ${atob(item.LastName)}`;
            item.PercentPMYear = Math.round(item.CntYear / PM_Year);
            item.PercentPMMonth = Math.round(item.CntMonth / PM_Month);
        }

        res.json({ PM_Month, PM_Year, tech: maintenance.recordset });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== MoldNo ==========
// Mold Data
router.post("/mold/specification", async (req, res) => { //TODO: ReceiveDate, Asset, UseIn
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let specification = await pool.request().query(`SELECT a.MoldNo, a.PartCode, a.PartName, b.CustomerName, c.MoldType, a.Asset
        FROM [Mold].[MasterMold] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Mold].[MasterMoldType] c ON c.MoldTypeID = a.MoldTypeID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(specification.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});
// Repair History
router.post("/mold/repair/history", async (req, res) => { //TODO:
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID, year } = req.body;
        let repairHistory = await pool.request().query(`SELECT a.RepairCheckID, b.RepairType, c.RepairProblem,
        CASE WHEN COUNT(DISTINCT e.SpareName) = 1 THEN MIN(e.SpareName)
            ELSE STRING_AGG(e.SpareName, ', ')
        END AS SpareName,
        SUM(CASE WHEN d.Reuse IS NULL OR d.Reuse = 0 THEN (d.Qty * d.UnitPrice) ELSE 0 END) AS Cost
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [Mold].[MasterRepairType] b ON b.RepairTypeID = a.RepairTypeID
        LEFT JOIN [Mold].[MasterRepairProblem] c ON c.RepairProblemID = a.RepairProblemID
        LEFT JOIN [Mold].[RepairCost] d ON d.RepairCheckID = a.RepairCheckID
        LEFT JOIN [Mold].[MasterSpare] e ON e.SpareID = d.SpareID
        WHERE a.MoldID = ${MoldID} AND YEAR(a.RequestTime) = ${year}
        GROUP BY a.RepairCheckID, b.RepairType, c.RepairProblem
        ORDER BY a.RepairCheckID;
        `);
        res.json(repairHistory.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});
router.post("/mold/chart", async (req, res) => { //TODO:
    try {
        let pool = await getPool('MoldPool', config);
        let { ChartType, year, MoldID } = req.body
        // ChartType: {1:Cost}, {2:ProblemCount}, {3:RepairTime}
        if(ChartType == 1){ // Cost
            var repair = await pool.request().query(`SELECT MONTH(b.UsedDate) AS M,
            SUM(CASE WHEN b.Reuse = 0 OR b.Reuse IS NULL THEN (b.UnitPrice * b.Qty) ELSE 0 END) AS Cost
            FROM [Mold].[RepairCheck] a
            LEFT JOIN [Mold].[RepairCost] b ON a.RepairCheckID = b.RepairCheckID
            WHERE YEAR(b.UsedDate) = ${year} AND a.MoldID = ${MoldID}
            GROUP BY MONTH(b.UsedDate);
            `);
            return res.json(repair.recordset);
        }
        else if(ChartType == 2){ // ProblemCount
            var repair = await pool.request().query(`SELECT MONTH(a.RequestTime) AS M, COUNT(a.RepairCheckID) AS CountProblem
            FROM [Mold].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = ${year} AND a.MoldID = ${MoldID}
            GROUP BY MONTH(a.RequestTime)
            `);
            return res.json(repair.recordset);
        }
        else if(ChartType == 3){ // Repair Time
            var repair = await pool.request().query(`SELECT MONTH(a.RequestTime) AS M, SUM(DATEDIFF(MINUTE, a.StartTime, a.EndTime)) AS RepairTime
            FROM [Mold].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = ${year} AND a.MoldID = ${MoldID}
            GROUP BY MONTH(a.RequestTime)
            `);
            return res.json(repair.recordset);
        }
        res.json([]);
    } catch(err){
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});
router.post("/mold/plan", async (req, res) => { //TODO:
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        // PlanFilter 1: All Plan, 2: Today Plan
        let moldPlan = await pool.request().query(`
        WITH cte AS (
            SELECT ROW_NUMBER() OVER (ORDER BY a.PlanDate DESC) AS RowNum, a.PmPlanID,
            a.MoldID, a.PlanDate, a.PmStart, a.PmEnd, a.MoldStatus, a.PmResult, a.Remark,
            a.PmBy, a.PmPlanNo, a.ConfirmBy, a.ConfirmTime, a.ApproveBy, a.ApproveTime
            FROM [Mold].[PmPlan] a
            WHERE a.MoldID = ${MoldID}
        )
        SELECT a.PmPlanID, a.MoldID, a.PlanDate, a.PmStart, a.PmEnd, a.MoldStatus, a.PmResult, a.Remark,
        a.PmBy, a.PmPlanNo, a.ConfirmBy, a.ConfirmTime, a.ApproveBy, a.ApproveTime,
        CASE
			WHEN a.PmEnd IS NOT NULL AND DATEDIFF(DAY, a.PmEnd, GETDATE()) >= 7 THEN 1
			WHEN a.PmEnd IS NOT NULL AND DATEDIFF(DAY, a.PmEnd, GETDATE()) < 7 THEN 3
			WHEN a.PmEnd IS NULL AND a.PlanDate > GETDATE() THEN 2
			WHEN a.PmEnd IS NULL AND a.PlanDate < GETDATE() THEN 4
		END AS PmStatus
        FROM [cte] a
        LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
        WHERE RowNum = 1;
        `);
        // PmStatus { 1: เทา, 2: แดง, 3: เขียว, 4: เหลือง }
        res.json(moldPlan.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});

module.exports = router;