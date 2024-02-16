const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const { getPool } = require('../../middlewares/pool-manager');

//* ========== Receive List ==========
router.post('/list', async (req, res) => { //TODO: Status, query
    try {
        let pool = await getPool('MoldPool', config);
        let { Status } = req.body;
        let receiveList = await pool.request().query(`
        SELECT a.MoldSpecID, a.CustomerID, b.CustomerName, a.PartCode, a.PartName, a.AxMoldNo,
        a.Model, a.IssuedDate, a.Status, c.DetailID
        FROM [Mold].[Specification] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Mold].[SpecificationDetail] c ON c.MoldSpecID = a.MoldSpecID
        WHERE Active = 1 
        `);
        res.json(receiveList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive', async (req, res) => { //TODO: insert
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, MoldID } = req.body;

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/takeout', async (req, res) => { //TODO: insert
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, MoldID } = req.body;

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Specification Detail ==========
router.post('/specification/detail/history', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let moldDetail = await pool.request().query(`SELECT c.DetailID, c.EditTime
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[Specification] b ON b.MoldSpecID = a.MoldSpecID
        LEFT JOIN [Mold].[SpecificationDetail] c ON c.MoldSpecID = c.MoldSpecID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/specification/detail', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { DetailID } = req.body;
        let moldDetail = await pool.request().query(`SELECT a.MachineSpec, a.ProductSpec, a.MoldSpec,
        a.hvtPicture, a.MoldSpecFile, a.MoldPicture, a.MoldDrawing1, a.MoldDrawing2,
        b.FirstName AS IssueBy, a.IssueSignTime,
        c.FirstName AS CheckBy, a.CheckSignTime,
        d.FirstName AS ApproveBy, a.ApproveSignTime
        FROM [Mold].[SpecificationDetail] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmpployeeID = a.IssueBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmpployeeID = a.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmpployeeID = a.ApproveBy
        WHERE a.DetailID = ${DetailID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Receive Detail ==========
router.post('/receive/detail', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let moldReceive = await pool.request().query(`SELECT a.MoldReceiveID, a.MoldSpecID,
        a.AppearanceInspect, a.MoldStructure, a.Remark, a.ImagePath,
        b.FirstName AS MoldIssueBy, c.FirstName AS MoldCheckBy, d.FirstName AS MoldApproveBy,
        e.FirstName AS EnCheckBy, f.FirstName AS EnApproveBy
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.MoldIssueBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.MoldCheckBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.MoldApprovBy = d.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON a.EnCheckBy = e.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON a.EnApprovBy = f.EmployeeID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(moldReceive.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router