const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const Redis = require('ioredis');
const redis = new Redis();
const { getPool } = require('../../middlewares/pool-manager');

//! Factory ???
//* ========= Dashboard ==========
router.post('/plan-complete', async (req, res) => { //TODO:
    try {
        let pool = await getPool('JigPool', config);
        let { month, year, FactoryID } = req.body;

        let planComplete = await pool.request()
        .input("Month", sql.Int, month)
        .input("Year", sql.Int, year)
        .input("FactoryID", sql.Int, FactoryID)
        .execute("PlanComplete");

        res.json(planComplete.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/total-average', async (req, res) => { //TODO: confirm User
    try {
        let pool = await getPool('JigPool', config);
        let { year, FactoryID } = req.body;
        let totalAndAverage = await pool.request().query(`
        DECLARE @CostYearlyEm FLOAT,
        @CostMonthlyEm FLOAT,
        @TotalPmTimeYearlyEm FLOAT,
        @TotalPmTimeMonthlyEm FLOAT,
        @AvgPmTimeYearlyEm FLOAT,
        @AvgPmTimeMonthlyEm FLOAT,
        @TotalServiceTimeYearlyEm FLOAT,
        @TotalServiceTimeMonthlyEm FLOAT,
        @AvgServiceTimeYearlyEm FLOAT,
        @AvgServiceTimeMonthlyEm FLOAT,
        @TotalProblemYearlyEm INT,
        @TotalProblemMonthlyEm INT,
        @CostYearlyAcc FLOAT,
        @CostMonthlyAcc FLOAT,
        @TotalPmTimeYearlyAcc FLOAT,
        @TotalPmTimeMonthlyAcc FLOAT,
        @AvgPmTimeYearlyAcc FLOAT,
        @AvgPmTimeMonthlyAcc FLOAT,
        @TotalServiceTimeYearlyAcc FLOAT,
        @TotalServiceTimeMonthlyAcc FLOAT,
        @AvgServiceTimeYearlyAcc FLOAT,
        @AvgServiceTimeMonthlyAcc FLOAT,
        @TotalProblemYearlyAcc INT,
        @TotalProblemMonthlyAcc INT;

        -- Cost
        SELECT @CostYearlyEm = SUM(a.Qty * a.UnitPrice),
        @CostMonthlyEm = SUM(CASE WHEN MONTH(a.UsedDate) = MONTH(GETDATE()) THEN (a.Qty * a.UnitPrice) END)
        FROM [Em].[RepairCost] a
        INNER JOIN [Em].[RepairCheck] b ON a.RepairCheckID = b.RepairCheckID
        INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = b.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
        WHERE YEAR(a.UsedDate) = ${year} AND d.FactoryID = ${FactoryID};

        SELECT @CostYearlyAcc = SUM(a.Qty * a.UnitPrice),
        @CostMonthlyAcc = SUM(CASE WHEN MONTH(a.UsedDate) = MONTH(GETDATE()) THEN (a.Qty * a.UnitPrice) END)
        FROM [Em].[RepairCost] a
        INNER JOIN [Em].[RepairCheck] b ON a.RepairCheckID = b.RepairCheckID
        INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID = b.AccessoryID
        LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
        LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
        WHERE YEAR(a.UsedDate) = ${year} AND f.FactoryID = ${FactoryID};

        -- PM
        SELECT @TotalPmTimeYearlyEm= SUM(DATEDIFF(MINUTE, a.PmStart, a.PmEnd)),
        @AvgPmTimeYearlyEm = AVG(DATEDIFF(MINUTE, a.Pmstart, a.PmEnd)),
        @TotalPmTimeMonthlyEm = SUM(CASE WHEN MONTH(b.PlanTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.PmStart, a.PmEnd) END),
        @AvgPmTimeMonthlyEm = AVG(CASE WHEN MONTH(b.PlanTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.Pmstart, a.PmEnd) END)
        FROM [Em].[PreventCheck] a
        LEFT JOIN [Em].[PreventPlan] b ON a.PreventPlanID = b.PreventPlanID
        INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = b.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
        WHERE YEAR(b.PlanTime) = ${year} AND d.FactoryID = ${FactoryID};

        SELECT @TotalPmTimeYearlyAcc = SUM(DATEDIFF(MINUTE, a.PmStart, a.PmEnd)),
        @AvgPmTimeYearlyAcc = AVG(DATEDIFF(MINUTE, a.Pmstart, a.PmEnd)),
        @TotalPmTimeMonthlyAcc = SUM(CASE WHEN MONTH(b.PlanTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.PmStart, a.PmEnd) END),
        @AvgPmTimeMonthlyAcc = AVG(CASE WHEN MONTH(b.PlanTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.Pmstart, a.PmEnd) END)
        FROM [Em].[PreventCheck] a
        LEFT JOIN [Em].[PreventPlan] b ON a.PreventPlanID = b.PreventPlanID
        INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID = b.AccessoryID
        LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
        LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
        WHERE YEAR(b.PlanTime) = ${year} AND f.FactoryID = ${FactoryID};

        -- Service
        SELECT @TotalServiceTimeYearlyEm = SUM(DATEDIFF(MINUTE, a.StartTime, a.EndTime)),
        @AvgServiceTimeYearlyEm = AVG(DATEDIFF(MINUTE, a.StartTime, a.EndTime)),
        @TotalProblemYearlyEm = COUNT(a.RepairCheckID),
        @TotalServiceTimeMonthlyEm = SUM(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.StartTime, a.EndTime) END),
        @AvgServiceTimeMonthlyEm = AVG(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.StartTime, a.EndTime) END),
        @TotalProblemMonthlyEm = COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END)
        FROM [Em].[RepairCheck] a
        INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
        WHERE a.Type = 2 AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${FactoryID};

        SELECT @TotalServiceTimeYearlyAcc = SUM(DATEDIFF(MINUTE, a.StartTime, a.EndTime)),
        @AvgServiceTimeYearlyAcc = AVG(DATEDIFF(MINUTE, a.StartTime, a.EndTime)),
        @TotalProblemYearlyAcc = COUNT(a.RepairCheckID),
        @TotalServiceTimeMonthlyAcc = SUM(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.StartTime, a.EndTime) END),
        @AvgServiceTimeMonthlyAcc = AVG(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN DATEDIFF(MINUTE, a.StartTime, a.EndTime) END),
        @TotalProblemMonthlyAcc = COUNT(CASE WHEN MONTH(a.RequestTime) = MONTH(GETDATE()) THEN a.RepairCheckID END)
        FROM [Em].[RepairCheck] a
        INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID = a.AccessoryID
        LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
        LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
        WHERE a.Type = 2 AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID};


        SELECT ISNULL(@CostYearlyEm,0) + ISNULL(@CostYearlyAcc,0) AS CostYearly,
        ISNULL(@CostMonthlyEm,0) + ISNULL(@CostMonthlyAcc,0) AS CostMonthly,
        ISNULL(@TotalPmTimeYearlyEm,0) + ISNULL(@TotalPmTimeYearlyAcc,0) AS TotalPmTimeYearly,
        ISNULL(@TotalPmTimeMonthlyEm,0) + ISNULL(@TotalPmTimeMonthlyAcc,0) AS TotalPmTimeMonthly,
        ISNULL(@AvgPmTimeYearlyEm,0) + ISNULL(@AvgPmTimeYearlyAcc,0) AS AvgPmTimeYearly,
        ISNULL(@AvgPmTimeMonthlyEm,0) + ISNULL(@AvgPmTimeMonthlyAcc,0) AS AvgPmTimeMonthly,
        ISNULL(@TotalServiceTimeYearlyEm,0) + ISNULL(@TotalServiceTimeYearlyAcc,0) AS TotalServiceTimeYearly,
        ISNULL(@TotalServiceTimeMonthlyEm,0) + ISNULL(@TotalServiceTimeMonthlyAcc,0) AS TotalServiceTimeMonthly,
        ISNULL(@AvgServiceTimeYearlyEm,0) + ISNULL(@AvgServiceTimeYearlyAcc,0) AS AvgServiceTimeYearly,
        ISNULL(@AvgServiceTimeMonthlyEm,0) + ISNULL(@AvgServiceTimeMonthlyAcc,0) AS AvgServiceTimeMonthly,
        ISNULL(@TotalProblemYearlyEm,0) + ISNULL(@TotalProblemYearlyAcc,0) AS TotalProblemYearly,
        ISNULL(@TotalProblemMonthlyEm,0) + ISNULL(@TotalProblemMonthlyAcc,0) AS TotalProblemMonthly;
        `);
        res.json(totalAndAverage.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/donut', async (req, res) => { //TODO:
    try {
        let pool = await getPool('JigPool', config);
        let { month, year, FactoryID, FilterType } = req.body;

        if(FilterType == 1){ // MachineGroup
            let cost = await pool.request().query(`WITH EmMachine AS (
                SELECT e.GroupTitle, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] e ON e.MachineGroupID= c.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT g.GroupTitle, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID = a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] g ON g.MachineGroupID = c.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT GroupTitle, Cost FROM [EmMachine]
                UNION ALL
                SELECT GroupTitle, Cost FROM [AccMachine]
            )
            SELECT GroupTitle, SUM(Cost) AS Cost FROM [tbsum]
            GROUP BY GroupTitle
            `);
            let problem = await pool.request().query(`WITH EmMachine AS (
                SELECT e.GroupTitle, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] e ON e.MachineGroupID = c.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT g.GroupTitle, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] g ON g.MachineGroupID= c.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT GroupTitle, RepairCheckID FROM [EmMachine]
                UNION ALL
                SELECT GroupTitle, RepairCheckID FROM [AccMachine]
            )
            SELECT GroupTitle, COUNT(RepairCheckID) AS CountProblem FROM [tbsum]
            GROUP BY GroupTitle
            `);
            let time = await pool.request().query(`WITH EmMachine AS (
                SELECT d.GroupTitle, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] d ON d.MachineGroupID = b.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT f.GroupTitle, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
                LEFT JOIN [Em].[MasterMachineGroup] f ON f.MachineGroupID = b.MachineGroupID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT GroupTitle, ProblemTime FROM [EmMachine]
                UNION ALL
                SELECT GroupTitle, ProblemTime FROM [AccMachine]
            )
            SELECT GroupTitle, SUM(ProblemTime) AS ProblemTime FROM [tbsum]
            GROUP BY GroupTitle
            `);
            return res.json({ cost: cost.recordset, problem: problem.recordset, time: time.recordset });
        }
        else if(FilterType == 2){ // Brand
            let cost = await pool.request().query(`WITH EmMachine AS (
                SELECT e.Maker, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                LEFT JOIN [Em].[MasterMaker] e ON e.MakerID = c.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT g.Maker, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID = a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                LEFT JOIN [Em].[MasterMaker] g ON g.MakerID = c.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Maker, Cost FROM [EmMachine]
                UNION ALL
                SELECT Maker, Cost FROM [AccMachine]
            )
            SELECT Maker, SUM(Cost) AS Cost FROM [tbsum]
            GROUP BY Maker
            `);
            let problem = await pool.request().query(`WITH EmMachine AS (
                SELECT e.Maker, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                LEFT JOIN [Em].[MasterMaker] e ON e.MakerID = c.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT g.Maker, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                LEFT JOIN [Em].[MasterMaker] g ON g.MakerID = c.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Maker, RepairCheckID FROM [EmMachine]
                UNION ALL
                SELECT Maker, RepairCheckID FROM [AccMachine]
            )
            SELECT Maker, COUNT(RepairCheckID) AS CountProblem FROM [tbsum]
            GROUP BY Maker
            `);
            let time = await pool.request().query(`WITH EmMachine AS (
                SELECT d.Maker, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
                LEFT JOIN [Em].[MasterMaker] d ON d.MakerID = b.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT f.Maker, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
                LEFT JOIN [Em].[MasterMaker] f ON f.MakerID = b.MakerID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Maker, ProblemTime FROM [EmMachine]
                UNION ALL
                SELECT Maker, ProblemTime FROM [AccMachine]
            )
            SELECT Maker, SUM(ProblemTime) AS ProblemTime FROM [tbsum]
            GROUP BY Maker
            `);
            return res.json({ cost: cost.recordset, problem: problem.recordset, time: time.recordset });
        }
        else if(FilterType == 3){ // Problem
            let cost = await pool.request().query(`WITH EmMachine AS (
                SELECT c.RepairProblem, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                LEFT JOIN [Em].[MasterRepairProblem] c ON c.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterEmMachine] d ON a.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT c.RepairProblem, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                LEFT JOIN [Em].[MasterRepairProblem] c ON c.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterAccessory] d ON a.AccessoryID = d.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] e ON d.AccessoryID = e.AccessoryID AND e.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] f ON e.EmMachineID = f.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] g ON f.MachineID = g.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND g.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT RepairProblem, Cost FROM [EmMachine]
                UNION ALL
                SELECT RepairProblem, Cost FROM [AccMachine]
            )
            SELECT RepairProblem, SUM(Cost) AS Cost FROM [tbsum]
            GROUP BY RepairProblem
            `);
            let problem = await pool.request().query(`WITH EmMachine AS (
                SELECT e.RepairProblem, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                LEFT JOIN [Em].[MasterRepairProblem] e ON e.RepairProblemID = a.RepairProblemID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT g.RepairProblem, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                LEFT JOIN [Em].[MasterRepairProblem] g ON g.RepairProblemID = a.RepairProblemID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT RepairProblem, RepairCheckID FROM [EmMachine]
                UNION ALL
                SELECT RepairProblem, RepairCheckID FROM [AccMachine]
            )
            SELECT RepairProblem, COUNT(RepairCheckID) AS CountProblem FROM [tbsum]
            GROUP BY RepairProblem
            `);
            let time = await pool.request().query(`WITH EmMachine AS (
                SELECT d.RepairProblem, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
                LEFT JOIN [Em].[MasterRepairProblem] d ON d.RepairProblemID = a.RepairProblemID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${year}
            ), AccMachine AS (
                SELECT f.RepairProblem, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
                LEFT JOIN [Em].[MasterRepairProblem] f ON f.RepairProblemID = a.RepairProblemID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${year}
            ), tbsum AS (
                SELECT RepairProblem, ProblemTime FROM [EmMachine]
                UNION ALL
                SELECT RepairProblem, ProblemTime FROM [AccMachine]
            )
            SELECT RepairProblem, SUM(ProblemTime) AS ProblemTime FROM [tbsum]
            GROUP BY RepairProblem
            `);
            return res.json({ cost: cost.recordset, problem: problem.recordset, time: time.recordset });
        }
        else if(FilterType == 4){ // Service, PM
            let cost = await pool.request().query(`WITH EmMachine AS (
                SELECT a.Type, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterEmMachine] c ON a.EmMachineID = c.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT a.Type, b.UnitPrice * b.Qty AS Cost
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
                INNER JOIN [Em].[MasterAccessory] c ON a.AccessoryID = c.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Type, Cost FROM [EmMachine]
                UNION ALL
                SELECT Type, Cost FROM [AccMachine]
            )
            SELECT Type, SUM(Cost) AS Cost FROM [tbsum]
            GROUP BY Type
            `);
            let problem = await pool.request().query(`WITH EmMachine AS (
                SELECT a.Type, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterEmMachine] c ON c.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON d.MachineID = c.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT a.Type, a.RepairCheckID
                FROM [Em].[RepairCheck] a
                LEFT JOIN [Em].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
                INNER JOIN [Em].[MasterAccessory] c ON c.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Type, RepairCheckID FROM [EmMachine]
                UNION ALL
                SELECT Type, RepairCheckID FROM [AccMachine]
            )
            SELECT Type, COUNT(RepairCheckID) AS CountProblem FROM [tbsum]
            GROUP BY Type
            `);
            let time = await pool.request().query(`WITH EmMachine AS (
                SELECT a.Type, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${FactoryID}
            ), AccMachine AS (
                SELECT a.Type, DATEDIFF(MINUTE, a.StartTime, a.EndTime) AS ProblemTime
                FROM [Em].[RepairCheck] a
                INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID= a.AccessoryID
                LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
                LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
                LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
                WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID}
            ), tbsum AS (
                SELECT Type, ProblemTime FROM [EmMachine]
                UNION ALL
                SELECT Type, ProblemTime FROM [AccMachine]
            )
            SELECT Type, SUM(ProblemTime) AS ProblemTime FROM [tbsum]
            GROUP BY Type
            `);
            return res.json({ cost: cost.recordset, problem: problem.recordset, time: time.recordset });
        }
        res.json([]);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/top', async (req, res) => { //TODO:
    try {
        let pool = await getPool('JigPool', config);
        let { month, year, FactoryID } = req.body;

        let topCost = await pool.request().query(`
        WITH EmMachine AS (
            SELECT d.MachineNo, SUM(b.UnitPrice * b.Qty) AS Cost
            FROM [Em].[RepairCheck] a
            LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
            INNER JOIN [Em].[MasterEmMachine] c ON a.EmMachineID = c.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] d ON c.MachineID = d.MachineID
            WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND d.FactoryID = ${FactoryID}
            GROUP BY d.MachineNo
        ), AccMachine AS (
            SELECT c.MachineNo, SUM(b.UnitPrice * b.Qty) AS Cost
            FROM [Em].[RepairCheck] a
            LEFT JOIN [Em].[RepairCost] b ON b.RepairCheckID = a.RepairCheckID
            INNER JOIN [Em].[MasterAccessory] c ON a.AccessoryID = c.AccessoryID
            LEFT JOIN [Em].[MasterMachineAcc] d ON d.AccessoryID = c.AccessoryID AND d.Active = 1
            LEFT JOIN [Em].[MasterEmMachine] e ON e.EmMachineID = d.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] f ON f.MachineID = e.MachineID
            WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND f.FactoryID = ${FactoryID}
            GROUP BY c.MachineNo
        ), tbsum AS (
            SELECT MachineNo, Cost FROM [EmMachine]
            UNION ALL
            SELECT MachineNo, Cost FROM [AccMachine]
        )
        SELECT TOP(3) MachineNo, Cost FROM [tbsum] ORDER BY Cost DESC
        `);
        let topShot = await pool.request().query(`WITH EmMachine AS (
            SELECT c.MachineNo, a.MonthlyShot
            FROM [MachineMonthlyShot] a
            INNER JOIN [Em].[MasterEmMachine] b ON a.EmMachineID = b.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON b.MachineID = c.MachineID
            WHERE MONTH(a.MonthYear) = ${month} AND YEAR(a.MonthYear) = ${year} AND c.FactoryID = ${FactoryID}
        ), AccMachine AS (
            SELECT b.MachineNo, a.MonthlyShot
            FROM [MachineMonthlyShot] a
            INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID= a.AccessoryID
            LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
            LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
            WHERE MONTH(a.MonthYear) = ${month} AND YEAR(a.MonthYear) = ${year} AND e.FactoryID = ${FactoryID}
        ), tbsum AS (
            SELECT MachineNo, MonthlyShot FROM [EmMachine]
            UNION ALL
            SELECT MachineNo, MonthlyShot FROM [AccMachine]
        )
        SELECT TOP(3) MachineNo, MonthlyShot FROM [tbsum] ORDER BY MonthlyShot DESC
        `);
        let topProblem = await pool.request().query(`
        WITH EmMachine AS (
            SELECT c.MachineNo, COUNT(a.RepairCheckID) AS CountProblem
            FROM [Em].[RepairCheck] a
            INNER JOIN [Em].[MasterEmMachine] b ON b.EmMachineID = a.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON c.MachineID = b.MachineID
            WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND c.FactoryID = ${FactoryID}
            GROUP BY c.MachineNo
        ), AccMachine AS (
            SELECT b.MachineNo, COUNT(a.RepairCheckID) AS CountProblem
            FROM [Em].[RepairCheck] a
            INNER JOIN [Em].[MasterAccessory] b ON b.AccessoryID = a.AccessoryID
            LEFT JOIN [Em].[MasterMachineAcc] c ON c.AccessoryID = b.AccessoryID AND c.Active = 1
            LEFT JOIN [Em].[MasterEmMachine] d ON d.EmMachineID = c.EmMachineID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON e.MachineID = d.MachineID
            WHERE MONTH(a.RequestTime) = ${month} AND YEAR(a.RequestTime) = ${year} AND e.FactoryID = ${FactoryID}
            GROUP BY b.MachineNo
        ), tbsum AS (
            SELECT MachineNo, CountProblem FROM [EmMachine]
            UNION ALL
            SELECT MachineNo, CountProblem FROM [AccMachine]
        )
        SELECT TOP(3) MachineNo, CountProblem FROM [tbsum] ORDER BY CountProblem DESC
        `);

        res.json({ topCost: topCost.recordset, topShot: topShot.recordset, topProblem: topProblem.recordset });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm-plan', async (req, res) => { //TODO: 2 Week
    try {
        let pool = await getPool('JigPool', config);
        let { FactoryID } = req.body;
        let startDate = new Date();
        let endDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() + 5);
        let startDateStr = `${startDate.getFullYear()}-${('00'+(startDate.getMonth()+1)).slice(-2)}-${('00'+startDate.getDate()).slice(-2)}`;
        let endDateStr = `${endDate.getFullYear()}-${('00'+(endDate.getMonth()+1)).slice(-2)}-${('00'+endDate.getDate()).slice(-2)}`;

        let pmPlan = await pool.request().query(`SELECT b.JigNo, CONVERT(NVARCHAR,a.PlanDate,23) AS PlanDate,
        CASE
            WHEN a.PmStart IS NULL THEN 1
            WHEN a.PmStart IS NOT NULL AND a.PmEnd IS NULL THEN 2
            WHEN a.PmStart IS NOT NULL AND a.PmEnd IS NOT NULL THEN 3
        END AS PlanStatus
        FROM [Jig].[PmPlan] a
        INNER JOIN [Jig].[MasterJig] b ON b.JigID = a.JigID
        WHERE a.PlanDate BETWEEN '${startDateStr}' AND '${endDateStr}'
        `);
        let data = [];
        for(let i = 0; i < 7; i++){
            let dateStr = `${startDate.getFullYear()}-${('00'+(startDate.getMonth()+1)).substr(-2)}-${('00'+startDate.getDate()).substr(-2)}`;
            let pmFiltered = pmPlan.recordset.filter(v => v.PlanDate == dateStr);

            data.push({ date: dateStr, PmPlan: pmFiltered });
            startDate.setDate(startDate.getDate()+1);
        }
        res.json(data);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart-shortage', async (req, res) => { // Shotage น้อยกว่า min, Remain/min
    try {
        let pool = await getPool('JigPool', config);
        let { month, year } = req.body;
        let sparepart = await pool.request().query(`WITH Spare AS(
            SELECT a.SpareID, a.BF, a.Received, a.Purchase
            FROM [Jig].[SpareMonth] a
            WHERE MONTH(a.MonthYear) = ${month} AND YEAR(a.MonthYear) = ${year}
        ), SpareUsed AS (
            SELECT a.SpareID, SUM(a.Qty) AS Qty
            FROM [Jig].[RepairCost] a
            WHERE MONTH(a.UsedDate) = ${month} AND YEAR(a.UsedDate) = ${year}
            GROUP BY a.SpareID
        ), tbsum AS (
            SELECT a.SpareName, ISNULL(b.BF,0) + ISNULL(b.Received,0) + ISNULL(b.Purchase,0) - ISNULL(c.Qty,0) AS Remain, a.Min
            FROM [Jig].[MasterSpare] a
            LEFT JOIN [Spare] b ON b.SpareID = a.SpareID
            LEFT JOIN [SpareUsed] c ON c.SpareID = a.SpareID
        )
        SELECT a.SpareName, a.Remain, a.Min FROM [tbsum] a WHERE a.Remain < a.Min;
        `);
        let total = await pool.request().query(`SELECT @Withdraw = SUM(a.Qty)
        FROM [Jig].[RepairCost] a
        WHERE MONTH(a.UsedDate) = ${month} AND YEAR(a.UsedDate) = ${year};

        SELECT @Receive = SUM(CASE WHEN a.RestockType = 1 THEN a.Qty END),
        @Purchase = SUM(CASE WHEN a.RestockType = 2 THEN a.Qty END)
        FROM [Jig].[SpareRestock] a
        WHERE MONTH(a.ReceiveDate) = ${month} AND YEAR(a.ReceiveDate) = ${year};

        SELECT @Withdraw AS Withdraw, @Receive AS Receive, @Purchase AS Purchase;
        `);
        res.json({ sparepart: sparepart.recordset, Receive: total.recordset[0]?.Receive, Withdraw: total.recordset[0]?.Withdraw });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/alert/total', async (req, res) => { //TODO: Avg. Check Time = เวลารอ Em มา Checkin
    try {
        let pool = await getPool('JigPool', config);
        let { month, year } = req.body;
        let total = await pool.request().query(`SELECT COUNT(a.EmCallID) AS CntEmCall, AVG(DATEDIFF(MINUTE, a.CreatedAt, a.CheckInAt)) AS AvgCheckTime
        FROM [Em].[EmCall] a
        WHERE MONTH(a.CreatedAt) = ${month} AND YEAR(a.CreatedAt) = ${year};
        `);

        res.json(total.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/alert/log', async (req, res) => { // cache alert log
    try {
        let alertLog = await redis.get('jig-alert-log');

        if(!alertLog) return res.json([]);

        let cur = new Date();
        let alertLogJSON = JSON.parse(alertLog);
        let alertLogFilter = alertLogJSON.filter(v => cur - new Date(`${v.date} ${v.time}`) < 43200000); // 12 Hour
        await redis.set('jig-alert-log', JSON.stringify(alertLogFilter));

        let alertLogSort = alertLogFilter.sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
        res.json(alertLogSort);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;