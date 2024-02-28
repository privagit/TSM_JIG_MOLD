const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const { getPool } = require('../../middlewares/pool-manager');

//* ========== Plan Confirm ==========
router.post('/', async (req, res) => { //TODO: PlanTime, From, To, WarrantyShot, RepairProcess
    try {
        let pool = await getPool('MoldPool', config);
        let { Status } = req.body;
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
        ), Pm AS (
            SELECT NULL AS RepairCheckID, a.PmPlanID, CONVERT(DATE, a.PlanTime) AS PmDate,
            NULL AS FromTime, NULL AS ToTime,
            b.BasicMold, b.DieNo, a.PmType AS PlanType, a.ActualShot,
            CASE WHEN a.PmType = 1 THEN e.WarningShot WHEN a.PmType = 2 THEN e.WarrantyWarningShot END AS WarningShot,
            CASE WHEN a.PmType = 1 THEN e.DangerShot WHEN a.PmType = 2 THEN e.WarrantyDangerShot END AS DangerShot,
            a.AcceptStatus, c.FirstName AS RequestBy, d.FirstName AS AcceptBy, a.AcceptReason, a.AcceptTime, a.RequestTime
            FROM [Mold].[PmPlan] a
            LEFT JOIN [Mold].[MasterMold] b ON b.MoldID = a.MoldID
            LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.RequestBy = c.EmployeeID
            LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.AcceptBy = d.EmployeeID
            LEFT JOIN [Mold].[MasterPm] e ON e.MoldID = a.MoldID
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
        res.json(planConfirm.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/confirm', async (req, res) => { //
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairCheckID, PmPlanID, PlanType, AcceptStatus, AcceptReason, AcceptBy, AcceptTime } = req.body;
        // 1: Accept, 2: Reject
        if(PlanType == 1 || PlanType == 2) { // Pm, Warranty
            let updateStatusPmPlan = `UPDATE [Mold].[PmPlan] SET AcceptStatus = ${AcceptStatus}, AcceptReason = N'${AcceptReason}',
            AcceptBy = ${AcceptBy}, AcceptTime = GETDATE() WHERE PmPlanID = ${PmPlanID}
            `;
            await pool.request().query(updateStatusPmPlan);
        } else{ // Repair
            let RepairStatus = AcceptStatus == 1 ? 2 : 1; // if Accept => RepairStatus = Plan(2), if Reject => RepairStatus = Issue(1)
            let updateStatusRepairPlan = `UPDATE [Mold].[RepairCheck] SET AcceptStatus = ${AcceptStatus}, AcceptReason = N'${AcceptReason}',
            AcceptBy = ${AcceptBy}, AcceptTime = GETDATE(), RepairStatus = ${RepairStatus} WHERE RepairCheckID = ${RepairCheckID}
            `;
            await pool.request().query(updateStatusRepairPlan);
        }
        await pool.request().query(updateStatusPmPlan);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/user/check', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { AcceptBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName, EmployeeID FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${AcceptBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        if(getUser.recordset.length){
            getUser.recordset[0].AcceptName = !getUser.recordset[0].FirstName ? null: atob(getUser.recordset[0].FirstName)
        }
        res.json(getUser.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router