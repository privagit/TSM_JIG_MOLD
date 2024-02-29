const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const Redis = require('ioredis');
const redis = new Redis();
const { getPool } = require('../../middlewares/pool-manager');

const whereClauseAnd = async (columns) => {
    try {
        let filter = ``;
        for(let item of columns){
            if(!item.value) continue;

            filter += !filter.length ? `WHERE ${item.column} = ${item.value}` : `AND ${item.column} ${item.value}`;
        }
        return filter;
    } catch (err) {
        console.log('whereClause', err);
        throw err;
    }

}

//* ========= overview ==========
router.post('/plan', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigTypeID, Section, PlanFilter,  } = req.body;

        let filterString = await whereClauseAnd([{ column: 'a.JigTypeID', value: JigTypeID }, { column: 'a.Section', value: Section }]);

        // PlanFilter 1: All Plan, 2: Today Plan
        if(PlanFilter == 1){ // All Plan
            var plans = await pool.request().query(`WITH cte AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.JigID ORDER BY a.PlanDate DESC) AS RowNum,
                a.PmPlanID, a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Jig].[PmPlan] a
            )
            SELECT a.JigID, a.JigNo, b.JigType, a.Section, c.CustomerName, d.PmPlanID, d.PmStart, d.PmEnd,
            CASE
                WHEN d.PmEnd IS NOT NULL AND DATEDIFF(DAY, d.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN d.PmEnd IS NOT NULL AND DATEDIFF(DAY, d.PmEnd, GETDATE()) < 7 THEN 3
                WHEN d.PmEnd IS NULL AND d.PlanDate > GETDATE() THEN 2
                WHEN d.PmEnd IS NULL AND d.PlanDate < GETDATE() THEN 4
            END AS PmStatus,
            CASE WHEN d.PmStart IS NULL THEN 0 ELSE 1 END AS IsStart, e.Location, e.JigStatus
            FROM [Jig].[MasterJig] a
            LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] c ON c.CustomerID = a.CustomerID
            LEFT JOIN [cte] d ON d.JigID = a.JigID AND d.RowNum = 1
            LEFT JOIN [Jig].[JigStatus] e ON e.JigID = d.JigID
            ${filterString};
            `);
        } else{ // Today Plan
            var plans = await pool.request().query(`WITH cte AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.JigID ORDER BY a.PlanDate DESC) AS RowNum,
                a.PmPlanID, a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Jig].[PmPlan] a
                WHERE a.PlanDate = GETDATE()
            )
            SELECT a.JigID, a.JigNo, b.JigType, a.Section, c.CustomerName, d.PmPlanID, d.PmStart, d.PmEnd,
            CASE
                WHEN d.PmEnd IS NOT NULL AND DATEDIFF(DAY, d.PmEnd, GETDATE()) >= 7 THEN 1
                WHEN d.PmEnd IS NOT NULL AND DATEDIFF(DAY, d.PmEnd, GETDATE()) < 7 THEN 3
                WHEN d.PmEnd IS NULL AND d.PlanDate > GETDATE() THEN 2
                WHEN d.PmEnd IS NULL AND d.PlanDate < GETDATE() THEN 4
            END AS PmStatus, CONVERT(NVARCHAR, d.PmEnd, 23) AS PmResult,
            CASE WHEN d.PmStart IS NULL THEN 0 ELSE 1 END AS IsStart, e.Location, e.JigStatus
            FROM [Jig].[MasterJig] a
            LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] c ON c.CustomerID = a.CustomerID
            LEFT JOIN [cte] d ON d.JigID = a.JigID AND d.RowNum = 1
            LEFT JOIN [Jig].[JigStatus] e ON e.JigID = d.JigID
            ${filterString};
            `);
        }
        await Promise.all(plans.recordset.map(async v => {
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
router.post('/jig/detail', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        var detail = await pool.request().query(`SELECT a.JigNo, a.PartCode, a.PartName, c.JigType, b.CustomerName
        FROM [Jig].[MasterJig] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Jig].[MasterJigType] c ON c.JigTypeID = a.JigTypeID
        WHERE a.JigID = ${JigID};
        `);
        res.json(detail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/pm/history', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        var historys = await pool.request().query(`SELECT a.PlanDate, a.PmStart, a.PmPlanID, a.PmPlanNo
        FROM [Jig].[PmPlan] a
        WHERE a.JigID = ${JigID};
        `);
        res.json(historys.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/start', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PmPlanID } = req.body;
        let startPredict = `UPDATE [Jig].[PmPlan] SET PmStart = GETDATE() WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(startPredict);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/topic', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        let pm = await pool.request().query(`SELECT a.PmID, a.JigID, a.Week, a.ImagePath, a.PmTopic
        FROM [Jig].[MasterPm] a
        WHERE a.JigID = ${JigID};
        `);
        let PmID = pm.recordset[0]?.PmID;
        if(!PmID) return res.status(400).send({ message: 'กรุณาตั้งค่า PM Topic ที่หน้า Setting ก่อน' });

        let topicId = JSON.parse(pm.recordset[0].PmTopic);
        if(topicId.length){
            let topics = await pool.request().query(`SELECT a.PmTopicID, a.Topic, a.TopicType, a.StandardValue
            FROM [Jig].[MasterPmTopic] a
            WHERE a.PmTopicID IN (${topicId.join(',')}) AND a.Active = 1;
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
router.post('/pm/checksheet', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PmPlanID } = req.body;
        var checksheet = await pool.request().query(`SELECT a.PmPlanID, a.PmStart, a.PmEnd, a.PmResult, a.JigStatus, a.PmPlanNo, a.Remark,
        b.FirstName AS ConfirmBy, a.ConfirmTime, c.FirstName AS ApproveBy, a.ApproveTime
        FROM [Jig].[PmPlan] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.ConfirmBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.ApproveBy
        WHERE a.PmPlanID = ${PmPlanID};
        `);
        res.json(checksheet.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/sign', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PmPlanID, ItemNo, EmployeeID } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        // Sign
        let ItemMap = { 1: 'Pm', 2: 'Confirm', 3: 'Approve' };
        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let timeString = (ItemNo == 2 || ItemNo == 3) ? `, ${ItemMap[ItemNo]}Time = '${curStr}'` : '';
        var sign = `UPDATE [Jig].[PmPlan] SET ${ItemMap[ItemNo]}By = ${EmployeeID} ${timeString} WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(sign);

        // io
        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let jig = await pool.request().query(`SELECT b.JigNo
        FROM [Jig].[PmPlan] a
        LEFT JOIN [Jig].[MasterJig] b ON b.JigID = a.JigID
        WHERE a.PmPlanID = ${PmPlanID};
        `);
        let alertLog = { JigNo: jig.recordset[0]?.JigNo, Module: 2, Action: 3, time: alertTime, date: alertDate }
        io.emit('jig-alert-log', alertLog);
        let cacheAlertLog = await redis.get('jig-alert-log');
        if(!cacheAlertLog){
            await redis.set('jig-alert-log', JSON.stringify([alertLog]));
        } else {
            let cur = new Date();
            let cacheAlertLogJSON = JSON.parse(cacheAlertLog);
            let cacheAlertLogFilter = cacheAlertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
            cacheAlertLogFilter.push(alertLog);
            await redis.set('jig-alert-log', JSON.stringify(cacheAlertLogFilter));
        }

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/technician', async (req, res) => { //TODO PM, Repair ?
    try {
        let pool = await getPool('JigPool', config);
        let maintenance = await pool.request().query(`WITH cte AS (
            SELECT b.UserID, b.FirstName, b.LastName,
            COUNT(a.RepairCheckID) AS CntYear,
            COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END) AS CntMonth,
            d.PositionName
            FROM [Jig].[RepairCheck] a
            INNER JOIN [TSMolymer_F].[dbo].[User] b ON a.RepairBy = b.EmployeeID
            LEFT JOIN [Jig].[MasterTechnician] c ON b.UserID = c.UserID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterPosition] d ON b.PositionID = d.PositionID
            WHERE YEAR(a.RequestTime) = YEAR(GETDATE())
            GROUP BY b.UserID, b.FirstName, b.LastName, d.PositionName
        ), cte2 AS (
            SELECT COUNT(a.RepairCheckID) AS totalYear,
            COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END) AS totalMonth
            FROM [Jig].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = YEAR(GETDATE())
        )
        SELECT a.UserID, a.FirstName, a.LastName, a.PositionName, b.ImagePath, b.SkillScore, a.CntMonth, a.CntYear,
        c.totalMonth, c.totalYear
        FROM [cte] a
        LEFT JOIN [Jig].[MasterTechnician] b ON a.UserID = b.UserID
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

//* ========== JigNo ==========
// Jig Data
router.post("/jig/specification", async (req, res) => { //TODO: ReceiveDate, Asset, UseIn
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        let specification = await pool.request().query(`SELECT a.JigNo, a.PartCode, a.PartName, b.CustomerName, c.JigType, a.Asset
        FROM [Jig].[MasterJig] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Jig].[MasterJigType] c ON c.JigTypeID = a.JigTypeID
        WHERE a.JigID = ${JigID};
        `);
        res.json(specification.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});
// Repair History
router.post("/jig/repair/history", async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID, year } = req.body;
        let repairHistory = await pool.request().query(`SELECT a.RepairCheckID, b.RepairType, c.RepairProblem,
        CASE WHEN COUNT(DISTINCT e.SpareName) = 1 THEN MIN(e.SpareName)
            ELSE STRING_AGG(e.SpareName, ', ')
        END AS SpareName,
        SUM(CASE WHEN d.Reuse IS NULL OR d.Reuse = 0 THEN (d.Qty * d.UnitPrice) ELSE 0 END) AS Cost
        FROM [Jig].[RepairCheck] a
        LEFT JOIN [Jig].[MasterRepairType] b ON b.RepairTypeID = a.RepairTypeID
        LEFT JOIN [Jig].[MasterRepairProblem] c ON c.RepairProblemID = a.RepairProblemID
        LEFT JOIN [Jig].[RepairCost] d ON d.RepairCheckID = a.RepairCheckID
        LEFT JOIN [Jig].[MasterSpare] e ON e.SpareID = d.SpareID
        WHERE a.JigID = ${JigID} AND YEAR(a.RequestTime) = ${year}
        GROUP BY a.RepairCheckID, b.RepairType, c.RepairProblem
        ORDER BY a.RepairCheckID;
        `);
        res.json(repairHistory.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});
router.post("/jig/chart", async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ChartType, year, JigID } = req.body
        // ChartType: {1:Cost}, {2:ProblemCount}, {3:RepairTime}
        if(ChartType == 1){ // Cost
            var repair = await pool.request().query(`SELECT MONTH(b.UsedDate) AS M,
            SUM(CASE WHEN b.Reuse = 0 OR b.Reuse IS NULL THEN (b.UnitPrice * b.Qty) ELSE 0 END) AS Cost
            FROM [Jig].[RepairCheck] a
            LEFT JOIN [Jig].[RepairCost] b ON a.RepairCheckID = b.RepairCheckID
            WHERE YEAR(b.UsedDate) = ${year} AND a.JigID = ${JigID}
            GROUP BY MONTH(b.UsedDate);
            `);
            return res.json(repair.recordset);
        }
        else if(ChartType == 2){ // ProblemCount
            var repair = await pool.request().query(`SELECT MONTH(a.RequestTime) AS M, COUNT(a.RepairCheckID) AS CountProblem
            FROM [Jig].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = ${year} AND a.JigID = ${JigID}
            GROUP BY MONTH(a.RequestTime)
            `);
            return res.json(repair.recordset);
        }
        else if(ChartType == 3){ // Repair Time
            var repair = await pool.request().query(`SELECT MONTH(a.RequestTime) AS M, SUM(DATEDIFF(MINUTE, a.StartTime, a.EndTime)) AS RepairTime
            FROM [Jig].[RepairCheck] a
            WHERE YEAR(a.RequestTime) = ${year} AND a.JigID = ${JigID}
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
router.post("/jig/plan", async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        // PlanFilter 1: All Plan, 2: Today Plan
        let jigPlan = await pool.request().query(`
        WITH cte AS (
            SELECT ROW_NUMBER() OVER (ORDER BY a.PlanDate DESC) AS RowNum, a.PmPlanID,
            a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.JigStatus, a.PmResult, a.Remark,
            a.PmBy, a.PmPlanNo, a.ConfirmBy, a.ConfirmTime, a.ApproveBy, a.ApproveTime
            FROM [Jig].[PmPlan] a
            WHERE a.JigID = ${JigID}
        )
        SELECT a.PmPlanID, a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.JigStatus, a.PmResult, a.Remark,
        a.PmBy, a.PmPlanNo, a.ConfirmBy, a.ConfirmTime, a.ApproveBy, a.ApproveTime,
        CASE
			WHEN a.PmEnd IS NOT NULL AND DATEDIFF(DAY, a.PmEnd, GETDATE()) >= 7 THEN 1
			WHEN a.PmEnd IS NOT NULL AND DATEDIFF(DAY, a.PmEnd, GETDATE()) < 7 THEN 3
			WHEN a.PmEnd IS NULL AND a.PlanDate > GETDATE() THEN 2
			WHEN a.PmEnd IS NULL AND a.PlanDate < GETDATE() THEN 4
		END AS PmStatus
        FROM [cte] a
        LEFT JOIN [Jig].[MasterJig] b ON b.JigID = a.JigID
        WHERE RowNum = 1;
        `);
        // PmStatus { 1: เทา, 2: แดง, 3: เขียว, 4: เหลือง }
        res.json(jigPlan.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
});

module.exports = router;