const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');

//* ========= overview ==========
router.post('/plan', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let { JigType, Section, PlanFilter,  } = req.body;
        // PlanFilter 1: All Plan, 2: Today Plan
        if(PlanFilter == 1){ // All Plan
            var plans = await pool.request().query(`WITH cte AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.JigID ORDER BY a.PlanDate DESC) AS RowNum,
                a.PmPlanID, a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Jig].[PmPlan] a
            )
            SELECT a.JigID, a.JigNo, b.JigType, a.Section, c.CustomerName, d.PmPlanID, d.PmStart, d.PmEnd
            FROM [Jig].[MasterJig] a
            LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] c ON c.CustomerID = a.CustomerID
            LEFT JOIN [cte] d ON d.JigID = a.JigID AND d.RowNum = 1;
            `);
        } else{ // Today Plan
            var plans = await pool.request().query(`WITH cte AS (
                SELECT ROW_NUMBER() OVER (PARTITION BY a.JigID ORDER BY a.PlanDate DESC) AS RowNum,
                a.PmPlanID, a.JigID, a.PlanDate, a.PmStart, a.PmEnd, a.PmPlanNo
                FROM [Jig].[PmPlan] a
                WHERE a.PlanDate = GETDATE()
            )
            SELECT a.JigID, a.JigNo, b.JigType, a.Section, c.CustomerName, d.PmPlanID, d.PmStart, d.PmEnd
            FROM [Jig].[MasterJig] a
            LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID
            LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] c ON c.CustomerID = a.CustomerID
            LEFT JOIN [cte] d ON d.JigID = a.JigID AND d.RowNum = 1;
            `);
        }

        res.json(plans.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/jig/detail', async (req, res) => {
    try {
        let pool = await sql.connect(config);
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
        let pool = await sql.connect(config);
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
        let pool = await sql.connect(config);
        let { PmPlanID } = req.body;
        let startPredict = `UPDATE [Jig].[PmPlan] SET PmStart = GETDATE() WHERE PmPlanID = ${PmPlanID};`;
        await pool.request().query(startPredict);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/topic', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
        let { JigID } = req.body;
        let pm = await pool.request().query(`SELECT a.JigID, a.Week, a.ImagePath, a.PmTopic
        FROM [Jig].[MasterPm] a
        WHERE a.JigID = ${JigID};
        `);
        let topicId = JSON.parse(pm.recordset[0].PmTopic);
        let topics = await pool.request().query(`SELECT a.PmTopicID, a.Topic, a.TopicType, a.StandardValue
        FROM [Jig].[MasterPmTopic] a
        WHERE a.PmTopicID IN (${topicId.join(',')}) AND a.Active = 1;
        `);
        pm.recordset[0].PmTopic = topics.recordset;
        res.json(pm.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/checksheet', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
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
router.post('/pm/sign', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
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

router.post('/technician', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
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

module.exports = router;