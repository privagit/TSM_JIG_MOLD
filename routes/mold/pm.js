const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const { getPool } = require('../../middlewares/pool-manager');

//* ========== PM ==========
router.post('/', async (req, res) => { //TODO: Condition AcceptStatus, Customer
    try {
        let pool = await getPool('MoldPool', config);
        let { Status } = req.body;
        // Status 1: Issue, 2: Cancel, 3: Reject, 4: Accept
        let pmList = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, b.WarningShot, b.DangerShot, b.WarrantyWarningShot, b.WarrantyDangerShot, b.AlertPercent, b.AlertWarrantyPercent,
        c.ActualPmShot, c.ActualWarrantyShot, a.Cavity, a.LastProduction
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        LEFT JOIN [Mold].[MoldShot] c ON c.MoldID = a.MoldID
        WHERE a.Active = 1;
        `);
        let pmRequest = await pool.request().query(`WITH PmPlan AS (
            SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID, a.PmType ORDER BY a.RequestTime DESC) AS RowNum,
            a.MoldID, a.PmType, a.AcceptStatus, a.PlanStartTime
            FROM [Mold].[PmPlan] a
            WHERE a.PmEnd IS NULL
        )
        SELECT MoldID, PmType, AcceptStatus, PlanStartTime, ROW_NUMBER() OVER (ORDER BY PlanStartTime) AS RowNo
        FROM [PmPlan]
        WHERE RowNum = 1;
        `);
        let repairRequest = await pool.request().query(`WITH Repair AS (
            SELECT ROW_NUMBER() OVER (PARTITION BY a.MoldID ORDER BY a.RequestTime DESC) AS RowNum,
            a.MoldID, a.RepairCheckID, a.RepairStatus, a.AcceptStatus, a.PlanStartTime,
            ISNULL(c.RepairProblem, b.RepairType) AS RepairProblem, a.RequestTime
            FROM [Mold].[RepairCheck] a
            LEFT JOIN [Mold].[MasterRepairType] b ON b.RepairTypeID = a.RepairTypeiD
	        LEFT JOIN [Mold].[MasterRepairProblem] c ON c.RepairProblemID = a.RepairProblemID
            WHERE a.EndTime IS NULL
        )
        SELECT MoldID, RepairStatus, AcceptStatus, ROW_NUMBER() OVER (ORDER BY PlanStartTime) AS RowNo, RepairProblem, RequestTime
        FROM [Repair]
        WHERE RowNum = 1;
        `);

        let moldArr = [];
        for(let mold of pmList.recordset){
            let needPM = false;
            let alertPm = Math.round(mold.AlertPercent * mold.WarningShot / 100);
            let alertWarranty = Math.round(mold.AlertWarrantyPercent * mold.WarrantyWarningShot / 100);
            if(mold.ActualPmShot >= alertPm || mold.ActualWarrantyShot >= alertWarranty){
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
                mold.PmStatus = !pm.length ? (mold.ActualPmShot >= alertPm ? 0 : null) : pm[0].AcceptStatus;
                mold.WarrantyStatus = !warranty.length ? (mold.ActualWarrantyShot >= alertWarranty ? 0 : null) : warranty[0].AcceptStatus;

                needPM = true;
            }

            let repairFiltered = repairRequest.recordset.filter(v => v.MoldID == mold.MoldID);
            if(repairFiltered.length){
                mold.RepairStatus = repairFiltered[0].RepairStatus;
                mold.RepairAcceptStatus = repairFiltered[0].AcceptStatus;
                mold.RepairProblem = repairFiltered[0].RepairProblem;
                mold.RepairRequestTime = repairFiltered[0].RequestTime;

                needPM = true;
            } else{
                mold.RepairStatus = null;
                mold.RepairAcceptStatus = null;
                mold.RepairProblem = null;
                mold.RepairRequestTime = null;
            }

            if(needPM){
                moldArr.push(mold);
            }
        }

        //TODO:
        if(Status){
        }

        res.json(pmList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/item', async (req, res) => { //? Filter PmRequest
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let mold = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, a.Cavity, a.LastProduction,
        b.WarningShot, b.DangerShot, b.WarrantyWarningShot, b.WarrantyDangerShot, b.AlertPercent, b.AlertWarrantyPercent,
        c.ActualPmShot, c.ActualWarrantyShot
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        LEFT JOIN [Mold].[MoldShot] c ON c.MoldID = a.MoldID
        WHERE a.MoldID = ${MoldID};
        `);
        let PmRequest = await pool.request().query(`SELECT a.PmPlanID, a.PmType, a.AcceptStatus, a.PmEnd
        FROM [Mold].[PmPlan] a
        WHERE a.MoldID = ${MoldID} AND a.PmEnd IS NULL AND a.AcceptStatus IN (0,1);
        `); // ตัวที่วาง Plan แล้ว
        let pmList = [];

        let alertPm = Math.round(mold.recordset[0].AlertPercent * mold.recordset[0].WarningShot / 100);
        let alertWarranty = Math.round(mold.recordset[0].AlertWarrantyPercent * mold.recordset[0].WarrantyWarningShot / 100);
        if(mold.recordset[0].ActualPmShot >= alertPm){ // PM
            pmList.push({
                MoldID: mold.recordset[0].MoldID,
                PmType: 1, PmTypeName: 'PM',
                ActualShot: mold.recordset[0].ActualPmShot,
                WarningShot: mold.recordset[0].WarningShot,
                DangerShot: mold.recordset[0].DangerShot
            })
        }
        if(mold.recordset[0].ActualWarrantyShot >= alertWarranty){ // Warranty
            pmList.push({
                MoldID: mold.recordset[0].MoldID,
                PmType: 2, PmTypeName: 'Warranty',
                ActualShot: mold.recordset[0].ActualWarrantyShot,
                WarningShot: mold.recordset[0].WarrantyWarningShot,
                DangerShot: mold.recordset[0].WarrantyDangerShot
            })
        }
        let pmListfiltered = pmList.filter(item => !PmRequest.recordset.some(pmr => pmr.MoldID == item.MoldID && pmr.PmType == item.PmType));
        res.json(pmListfiltered);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/pm/request', async (req, res) => { // request PM
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID, PmList, PlanStartTime, RequestBy } = req.body;
        let PlanTime = new Date(PlanStartTime);
        let FinishTime = new Date(PlanStartTime);

        console.log(req.body);
        // PmList = [{PmType, Actual, PmTime, Remark}]
        for(let item of PmList){
            FinishTime.setMinutes(PlanTime.getMinutes() + (item.PmTime || 0));
            let PlanTimeStr = `${PlanTime.getFullYear()}-${PlanTime.getMonth()+1}-${PlanTime.getDate()} ${PlanTime.getHours()}:${PlanTime.getMinutes()}:${PlanTime.getSeconds()}`;
            let FinishTimeStr = `${FinishTime.getFullYear()}-${FinishTime.getMonth()+1}-${FinishTime.getDate()} ${FinishTime.getHours()}:${FinishTime.getMinutes()}:${FinishTime.getSeconds()}`;

            // Insert PmPlan
            // PlanStatus = 0: Wait Accept, 1: Accept, 2: Reject, 3: Cancel
            let insertPlan = `INSERT INTO [Mold].[PmPlan](MoldID, PlanStartTime, PlanFinishTime, PmTime, PmType, ActualShot, Remark, RequestBy, RequestTime, AcceptStatus)
            VALUES(${MoldID}, '${PlanTimeStr}', '${FinishTimeStr}', ${item.PmTime || 0}, ${item.PmType}, ${item.Actual}, N'${item.Remark}', ${RequestBy || 0}, GETDATE(), 0);
            `;
            await pool.request().query(insertPlan);
            PlanTime = FinishTime; // set next start plan time
        }

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/item', async (req, res) => { // repair list that Status = issue
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let repairList = await pool.request().query(`SELECT a.RepairCheckID, a.RequestTime, b.RepairProblem
        FROM [Mold].[RepairCheck] a
        LEFT JOIN [Mold].[MasterRepairProblem] b ON b.RepairProblemID = a.RepairProblemID
        WHERE a.MoldID = ${MoldID} AND a.RepairStatus = 1;
        `);
        res.json(repairList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/request', async (req, res) => { //TODO: request Repair
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairList, PlanStartTime } = req.body;
        let PlanTime = new Date(PlanStartTime);
        let FinishTime = new Date(PlanStartTime);

        // RepairList = [{RepairCheckID, EstTime, Remark}]
        for(let item of RepairList){
            FinishTime.setMinutes(PlanTime.getMinutes() + item.EstTime);
            let PlanTimeStr = `${PlanTime.getFullYear()}-${PlanTime.getMonth()+1}-${PlanTime.getDate()} ${PlanTime.getHours()}:${PlanTime.getMinutes()}:${PlanTime.getSeconds()}`;
            let FinishTimeStr = `${FinishTime.getFullYear()}-${FinishTime.getMonth()+1}-${FinishTime.getDate()} ${FinishTime.getHours()}:${FinishTime.getMinutes()}:${FinishTime.getSeconds()}`;

            // Insert RepairPlan
            // PlanStatus = 0: Wait Accept, 1: Accept, 2: Reject
            let insertPlan = `INSERT INTO [Mold].[RepairPlan](RepairCheckID, PlanStartTime, PlanFinishTime, PlanStatus)
            VALUES(${item.RepairCheckID}, '${PlanTimeStr}', '${FinishTimeStr}', 0);
            `;
            await pool.request().query(insertPlan);
            PlanTime = FinishTime; // set next start plan time
        }

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/request/v1', async (req, res) => { //! Deprecated: request Repair
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
router.post('/repair/process', async (req, res) => { //! Deprecated: initial Process
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let mold = await pool.request().query(`SELECT a.MoldID, a.BasicMold, a.DieNo, a.Cavity, a.LastProduction,
        b.WarningShot, b.DangerShot, b.WarrantyWarningShot, b.WarrantyDangerShot, b.AlertPercent, b.AlertWarrantyPercent
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
router.post('/plan', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { Status, month, year } = req.body;
        // Status 1: Issue, 2: Cancel, 3: Reject, 4: Accept
        let planConfirm = await pool.request().query(`WITH Repair AS (
            SELECT a.RepairCheckID, NULL AS PmPlanID, CONVERT(DATE, a.PlanStartTime) AS PmDate,
            CONVERT(NVARCHAR(5), a.PlanStartTime, 108) AS FromTime,
            CONVERT(NVARCHAR(5), a.PlanFinishTime, 108) AS ToTime,
            b.BasicMold, b.DieNo, 3 AS PlanType, NULL AS ActualShot, NULL AS WarningShot, NULL AS DangerShot,
            a.RepairStatus,
            a.AcceptStatus, c.FirstName AS RequestBy, d.FirstName AS AcceptBy, a.AcceptReason, a.AcceptTime, a.RequestTime
            FROM [Mold].[RepairCheck] a
            LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
            LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.RequestBy = c.EmployeeID
            LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.AcceptBy = d.EmployeeID
            WHERE MONTH(a.PlanStartTime) = ${month} AND YEAR(a.PlanStartTime) = ${year}
        ), Pm AS (
            SELECT NULL AS RepairCheckID, a.PmPlanID, CONVERT(DATE, a.PlanStartTime) AS PmDate,
            CONVERT(NVARCHAR(5),a.PlanStartTime,108) AS FromTime, CONVERT(NVARCHAR(5),a.PlanFinishTime,108) AS ToTime,
            b.BasicMold, b.DieNo, a.PmType AS PlanType, a.ActualShot,
            CASE WHEN a.PmType = 1 THEN e.WarningShot WHEN a.PmType = 2 THEN e.WarrantyWarningShot END AS WarningShot,
            CASE WHEN a.PmType = 1 THEN e.DangerShot WHEN a.PmType = 2 THEN e.WarrantyDangerShot END AS DangerShot,
            a.AcceptStatus, c.FirstName AS RequestBy, d.FirstName AS AcceptBy, a.AcceptReason, a.AcceptTime, a.RequestTime
            FROM [Mold].[PmPlan] a
            LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
            LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.RequestBy = c.EmployeeID
            LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.AcceptBy = d.EmployeeID
            LEFT JOIN [Mold].[MasterPm] e ON e.MoldID = a.MoldID
            WHERE MONTH(a.PlanStartTime) = ${month} AND YEAR(a.PlanStartTime) = ${year}
        ), tbsum AS (
            SELECT RepairCheckID, PmPlanID, PmDate, FromTime, ToTime, BasicMold, DieNo, PlanType, ActualShot, WarningShot, DangerShot,
            AcceptStatus, RequestBy, AcceptBy, AcceptReason, AcceptTime, RequestTime
            FROM [Repair]
            UNION ALL
            SELECT RepairCheckID, PmPlanID, PmDate, FromTime, ToTime, BasicMold, DieNo, PlanType, ActualShot, WarningShot, DangerShot,
            AcceptStatus, RequestBy, AcceptBy, AcceptReason, AcceptTime, RequestTime
            FROM [Pm]
        )
        SELECT RepairCheckID, PmPlanID, PmDate, FromTime, ToTime, BasicMold, DieNo, PlanType, ActualShot, WarningShot, DangerShot,
            AcceptStatus, RequestBy, AcceptBy, AcceptReason, AcceptTime, RequestTime
        FROM [tbsum]
        `);
        if(Status){
            let planConfirmFiltered = planConfirm.recordset.filter(v => v.AcceptStatus == Status);
            return res.json(planConfirmFiltered);
        }
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/plan/cancel', async (req, res) => { // Cancel Plan
    try {
        let pool = await getPool('MoldPool', config);
        let { PmPlanID, RepairPlanID } = req.body;
        if(PmPlanID){
            // AcceptStatus { 0: Wait Accept, 1: Accept, 2: Reject, 3: Cancel }
            let cancelPm = `UPDATE [Mold].[PmPlan] SET AcceptStatus = 3 WHERE PmPlanID = ${PmPlanID};`;
            await pool.request().query(cancelPm);
        }
        else if(RepairCheckID){
            let cancelRepair = `UPDATE [Mold].[RepairPlan] SET PlanStatus = 3 WHERE RepairPlanID = ${RepairPlanID};`;
            await pool.request().query(cancelRepair);
        }
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Shot ==========
router.post('/pm/shot/edit', async (req, res) => { //TODO: Check User Position, adjust Shot
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID, AddShot } = req.body;

        let updateShot = `UPDATE [Mold].[MasterMold] SET ActualPmShot = ISNULL(ActualPmShot,0) + ${AddShot}
        ActualWarrantyShot = ISNULL(ActualWarrantyShot,0) + ${AddShot}
        WHERE MoldID = ${MoldID};
        `;
        await pool.request().query(updateShot);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


module.exports = router


//* RepairStatus
// 1: Issue     => Issue Repair
// 2: Plan      => Plan ที่ PM Plan
// 3: Repair    => Start Repair
// 4: Wait Sign => Sign Repair (Wait Inj,Qc,Mold Sign)
// 5: Complete  => Sign Inj,Qc,Mold

//* Repair PlanStatus
// 1: Accept => Accept at ConfirmPlan
// 2: Reject => Reject at ConfirmPlan
// 3: Cancel => Cancel at PmPlan