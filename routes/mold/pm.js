const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const { getPool } = require('../../middlewares/pool-manager');

//* ========== PM ==========
router.post('/', async (req, res) => { //TODO: RepairRequest, Condition AcceptStatus
    try {
        let pool = await getPool('MoldPool', config);
        let { Status } = req.body;
        // Status 1: Issue, 2: Cancel, 3: Reject, 4: Accept
        let pmList = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, b.WarningShot, b.DangerShot, b.WarrantyShot, b.AlertPercent, b.AlertWarrantyPercent
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        WHERE a.Active = 1;
        `);
        let pmRequest = await pool.request().query(`WITH PmPlan AS (
            SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID, a.PmType ORDER BY a.RequestTime DESC) AS RowNum,
            a.MoldID, a.PmType, a.AcceptStatus, a.PlanTime
            FROM [Mold].[PmPlan] a
            WHERE a.PmEnd IS NULL
        )
        SELECT MoldID, PmType, AcceptStatus, PlanTime, ROW_NUMBER() OVER (ORDER BY PlanTime) AS RowNo
        FROM [PmPlan]
        WHERE RowNum = 1;
        `);
        //TODO:
        let repairRequest = await pool.request().query(``);

        if(Status){ //TODO:
        }

        let moldArr = [];
        for(let mold of pmList.recordset){
            let needPM = false;
            let alertPm = Math.round(mc.AlertPercent * mc.WarningShot / 100);
            let alertWarranty = Math.round(mc.AlertWarrantyPercent * mc.WarrantyShot / 100);
            if(mold.ActualPmShot >= alertPm || mc.ActualWarrantyShot >= alertWarranty){
                let pm = pmRequest.recordset.filter(v => v.MoldID == mold.MoldID && v.PmType == 1); // Pm
                let warranty = pmRequest.recordset.filter(v => v.MoldID == mold.MoldID && v.PmType == 2); // Warranty

                //* Check min PlanTime
                //TODO: Condition
                let minPlanTimeNo
                if(pm.length && pm[0]?.AcceptStatus == 1){
                    minPlanTimeNo = pm[0].RowNo;
                }
                if(warranty.length && warranty[0]?.AcceptStatus == 1){
                    minPlanTimeNo = warranty[0].RowNo;
                }

                mold.minPlanTimeNo = minPlanTimeNo;
                mold.PmStatus = !pm.length ? (mc.MonthlyShot >= alertMonthly ? 0 : null) : pm[0].AcceptStatus;
                mold.WarrantyStatus = !warranty.length ? (mc.MonthlyShot >= alertMonthly ? 0 : null) : warranty[0].AcceptStatus;

                needPM = true;
            }

            if(needPM){
                moldArr.push(mold);
            }
        }
        res.json(pmList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/pm/item', async (req, res) => { //TODO: pm list
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let mold = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, a.Cavity, a.LastProduction,
        b.WarningShot, b.DangerShot, b.WarrantyShot, b.AlertPercent, b.AlertWarrantyPercent
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        WHERE a.MoldID = ${MoldID};
        `);
        let PmRequest = await pool.request().query();
        let pmList = [];

        let alertPm = Math.round(mold.recordset[0].AlertPercent * mold.recordset[0].WarningShot / 100);
        let alertWarranty = Math.round(mold.recordset[0].AlertWarrantyPercent * mold.recordset[0].WarrantyShot / 100);

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/request', async (req, res) => { //TODO: request PM
    try {
        let pool = await getPool('MoldPool', config);
        
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/item', async (req, res) => { // repair list
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let repairList = await pool.request().query(`SELECT a.RepairCheckID, a.RequestTime, b.RepairProblem
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [Mold].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(repairList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/request', async (req, res) => { // request Repair
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairList, PlanStartTime } = req.body;
        let PlanTime = new Date(PlanStartTime);
        let FinishTime = new Date(PlanStartTime);

        let Process = await pool.request().query(`SELECT ProcessID, Detail, CostPerHour
        FROM [Mold].[MasterProcess]
        WHERE ProcessType = 2 AND Active = 1;
        `);

        // RepairList = [{RepairCheckID, EstTime, RepairProcess: { ProcessID } }]
        for(let item of RepairList){
            FinishTime.setMinutes(PlanTime.getMinutes() + item.EstTime);
            let PlanTimeStr = `${PlanTime.getFullYear()}-${PlanTime.getMonth()+1}-${PlanTime.getDate()} ${PlanTime.getHours()}:${PlanTime.getMinutes()}:${PlanTime.getSeconds()}`;
            let FinishTimeStr = `${FinishTime.getFullYear()}-${FinishTime.getMonth()+1}-${FinishTime.getDate()} ${FinishTime.getHours()}:${FinishTime.getMinutes()}:${FinishTime.getSeconds()}`;

            // Insert RepairPlan
            // PlanStatus = 0: Wait Accept, 1: Accept, 2: Reject
            let insertPlan = await pool.request().query(`INSERT INTO [Mold].[RepairPlan](RepairCheckID, PlanStartTime, PlanFinishTime, PlanStatus)
            VALUES(${item.RepairCheckID}, '${PlanTimeStr}', '${FinishTimeStr}', 0);

            SELECT SCOPE_IDENTITY() AS RepairPlanID;
            `);
            let RepairPlanID = insertPlan.recordset[0].RepairPlanID;

            // Insert RepairProcess
            let ProcessStatement = [];
            for(let process of item.RepairProcess){
                let processFilter = Process.recordset.filter(v => v.ProcessID == process.ProcessID);
                let insertProcess = `INSERT INTO [Mold].[RepairProcess](RepairPlanID, ProcessID, ProcessDetail, EstTime, CostPerHour)
                VALUES(${RepairPlanID}, ${process.ProcessID}, N'${processFilter[0].Detail}', ${process.EstTime}, ${processFilter[0].CostPerHour});
                `;
                ProcessStatement.push(insertProcess);
            }
            if(ProcessStatement.length){
                await pool.request().query(ProcessStatement.join(''));
            }

            PlanTime = FinishTime; // set next start plan time
        }

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

router.post('/repair/process', async (req, res) => { //TODO: initial Process
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let mold = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, a.Cavity, a.LastProduction,
        b.WarningShot, b.DangerShot, b.WarrantyShot, b.AlertPercent, b.AlertWarrantyPercent
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        WHERE a.MoldID = ${MoldID};
        `);
        let PmRequest = await pool.request().query();
        let pmList = [];

        let alertPm = Math.round(mold.recordset[0].AlertPercent * mold.recordset[0].WarningShot / 100);
        let alertWarranty = Math.round(mold.recordset[0].AlertWarrantyPercent * mold.recordset[0].WarrantyShot / 100);

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Plan Confirm ==========
router.post('/plan', async (req, res) => { //TODO: Plan List
    try {
        let pool = await getPool('MoldPool', config);
        
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/plan/cancel', async (req, res) => { //TODO: Cancel Plan
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID, RepairCheckID } = req.body;
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})



module.exports = router