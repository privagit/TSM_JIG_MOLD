const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const { getPool } = require('../../middlewares/pool-manager');


const UpdateOrder = async (Planning_No, PlanDate, OrderStatus, ItemID) => {
    try {
        let pool = await getPool('JigPool', config);
        let date = new Date(PlanDate);

        let sheet = await pool.request().query(`SELECT D1,D2,D3,D4,D5,D6,D7,D8,D9,D10,D11,D12,D13,D14,D15,D16,D17,D18,D19,D20,D21,D22,D23,D24,D25,D26,D27,D28,D29,D30,D31
        FROM [TSMolymer_F].[Planner].[Inject_Inj_Sheet]
        WHERE Planning_No = '${Planning_No}' AND ItemID = 18
        `);
        let OrderNo = sheet.recordset[0][`D${date.getDate()}`];
        let updateOrder = 'UPDATE [TSMolymer_F].[Planner].[Inject_Inj_Sheet] SET ';
        let index = 0;
        for (let key in sheet.recordset[0]) {
            if ((sheet.recordset[0][key] == OrderNo && OrderNo != '' && OrderNo != null) || (key == 'D' + date.getDate())) {
                if (index == 0) {
                    updateOrder += `${key} = ${OrderStatus}`;
                } else {
                    updateOrder += `, ${key} = ${OrderStatus}`;
                }
                index++;
            }
        }
        updateOrder += ` WHERE Planning_No = '${Planning_No}' AND ItemID = ${ItemID}`;
        await pool.request().query(updateOrder);
    } catch (err) {
        console.log('UpdateOrder InjSupport', err);
        throw err;
    }
}

//* Jig
router.post('/jig', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ProductionDate, Shift, ZoneID, MachineID, Status } = req.body;
      
        let selectJigs = await pool.request().query(`SELECT row_number() over(order by a.PrepareID desc) as 'index',
        a.PrepareID, e.MachineID, e.MachineNo, e.ZoneID, f.JigNo, c.FirstName AS PrepareBy, a.Status, d.FirstName AS InstallBy, a.InstallStatus,
        a.Shift, CONVERT(VARCHAR, a.PrepareDateTime, 23) AS PrepareDate, CONVERT(VARCHAR(5), a.PrepareDateTime, 108) AS PrepareTime,
        CONVERT(VARCHAR, a.ProductionDateTime, 23) AS ProductionDate, CONVERT(VARCHAR(5), a.ProductionDateTime, 108) AS ProductionTime,
        CONVERT(VARCHAR(5), a.InstallTime, 108) AS InstallTime, a.Tube, a.DailyCheck, a.Dummy, a.Remark, f.JigID,
        CONVERT(VARCHAR(5), a.ReadyTime, 108) AS ReadyTime
        FROM [Jig].[Prepare] a
        LEFT JOIN [TSMolymer_F].[Planner].[Plan_Inject] b ON a.Planning_No = b.Planning_No
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.PrepareBy = c.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.InstallBy = d.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON a.MachineID = e.MachineID
        LEFT JOIN [Jig].[MasterJig] f ON f.JigID = a.JigID
        `);
        // WHERE CONVERT(VARCHAR, a.ProductionDateTime, 23) = '${ProductionDate}';
        
        let jigs = selectJigs.recordset;

        //* Filter
        if (Shift != 'All') {
            jigs = jigs.filter(v => v.Shift == Shift);
        }
        if (ZoneID != 'All') {
            jigs = jigs.filter(v => v.ZoneID == ZoneID);
        }
        if (MachineID != 'All') {
            jigs = jigs.filter(v => v.MachineID == MachineID);
        }
        if (Status != 'All') { // 0 = issue, 1 = ready, 2 = reject
            jigs = jigs.filter(v => v.Status == Status);
        }

        jigs.forEach(item => {
            item.PrepareBy = atob(item.PrepareBy || '') || '-';
            item.InstallBy = atob(item.InstallBy || '') || '-';
        })

        res.json(jigs);
    } catch (err) {
        console.log('/support/jig', err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/jig/edit', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PrepareID, Status, Remark, Tube, DailyCheck, Dummy } = req.body;
        let UserID = req.session.UserID;
        // status 0 = issue, 1 = ready, 2 = reject
        let updateStatus = `UPDATE [Jig].[Prepare] SET Status = ${Status}, Remark = '${Remark}', PrepareBy = ${UserID},
        ReadyTime = GETDATE(), Tube = ${Tube}, DailyCheck = ${DailyCheck}, Dummy = ${Dummy}
        WHERE logID = ${logID}
        `;
        await pool.request().query(updateStatus);

        //* handle OrderStatus
        if (Status == 1) { // Ready
            var OrderStatus = 1;
        } else { // Issue & Reject
            var OrderStatus = 0;
        }

        let prepare = await pool.request().query(`DECLARE @DayOfPlan INT
        DECLARE @Planning_No NVARCHAR(50)
        DECLARE @MachineNo NVARCHAR(10)
        DECLARE @PlanDate NVARCHAR(10)
        DECLARE @InstallStatus NVARCHAR(1)
        DECLARE @Status NVARCHAR(1)

        SELECT @DayOfPlan = DAY(PlanDate), @Planning_No = Planning_No, @MachineNo = b.MachineNo, @PlanDate = CONVERT(NVARCHAR, a.PlanDate, 23),
        @InstallStatus = CONVERT(NVARCHAR(1), ISNULL(a.InstallStatus, 0)), @Status = CONVERT(NVARCHAR(1), ISNULL(a.Status, 0))
        FROM [Jig].[JigInjection] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] b ON a.MachineID = b.MachineID
        WHERE PrepareID = ${PrepareID}

        DECLARE @ColumnName NVARCHAR(10)
        SET @ColumnName = 'D' + CAST(@DayOfPlan AS nvarchar(2))

        DECLARE @SQL NVARCHAR(MAX)
        SET @SQL = 'SELECT ' + QUOTENAME(@ColumnName) +' AS Sequence, '+ CONVERT(nvarchar(2), @DayOfPlan) + ' AS DayOfPlan, '''+ @MachineNo + ''' AS MachineNo, ''' + @PlanDate + ''' AS PlanDate, '''
        + @InstallStatus + ''' AS InstallStatus, ''' + @Status + ''' AS Status ' +'FROM [TSMolymer_F].[Planner].[Inject_Inj_Sheet] a
        WHERE a.ItemID = 19 AND Planning_No = ''' + @Planning_No + ''''
        EXEC(@SQL)
        `);
        let Plans = await pool.request().query(`SELECT a.Planning_No
        FROM [TSMolymer_F].[Planner].[Plan_Inject] a
        LEFT JOIN [TSMolymer_F].[Planner].[Inject_Inj_Sheet] b ON a.Planning_No = b.Planning_No
        WHERE b.ItemId = 19 AND a.Machine_No = '${prepare.recordset[0].MachineNo}' AND b.D${prepare.recordset[0].DayOfPlan} = '${prepare.recordset[0].Sequence}'
        `);
        const JigItemID = 30;
        for (let plan of Plans.recordset) {
            UpdateOrder(plan.Planning_No, prepare.recordset[0].PlanDate, OrderStatus, JigItemID);
        }

        const io = req.app.get('socketio');
        io.emit('reload-tbJigConfirm');
        res.json({ message: 'Success' });
    } catch (err) {
        console.log('/support/jig/edit', err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/jig/confirm', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { ProductionDate, Shift, ZoneID, MachineID, Status } = req.body;
        let selectJigs = await pool.request().query(`SELECT row_number() over(order by a.PrepareID desc) as 'index',
        a.PrepareID, e.MachineID, e.MachineNo, e.ZoneID, a.JigNo, c.FirstName AS PrepareBy, a.Status, d.FirstName AS InstallBy, a.InstallStatus,
        a.Shift, CONVERT(VARCHAR, a.PrepareDateTime, 23) AS PrepareDate, CONVERT(VARCHAR(5), a.PrepareDateTime, 108) AS PrepareTime,
        CONVERT(VARCHAR, a.ProductionDateTime, 23) AS ProductionDate, CONVERT(VARCHAR(5), a.ProductionDateTime, 108) AS ProductionTime,
        CONVERT(VARCHAR(5), a.InstallTime, 108) AS InstallTime, a.Tube, a.DailyCheck, a.Dummy,
        CONVERT(VARCHAR(5), a.ReadyTime, 108) AS ReadyTime, a.Remark
        FROM [Jig].[Prepare] a
        LEFT JOIN [TSMolymer_F].[Planner].[Plan_Inject] b ON a.Planning_No = b.Planning_No
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.PrepareBy = c.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.InstallBy = d.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON a.MachineID = e.MachineID
        WHERE CONVERT(VARCHAR, a.ProductionDateTime, 23) = '${ProductionDate}'
        `);
        let jigs = selectJigs.recordset;

        //* Filter
        if (Shift != 'All') {
            jigs = jigs.filter(v => v.Shift == Shift);
        }
        if (ZoneID != 'All') {
            jigs = jigs.filter(v => v.ZoneID == ZoneID);
        }
        if (MachineID != 'All') {
            jigs = jigs.filter(v => v.MachineID == MachineID);
        }
        if (Status != 'All') {
            jigs = jigs.filter(v => v.Status == Status);
        }

        jigs.forEach(item => {
            item.PrepareBy = atob(item.PrepareBy || '') || '-';
            item.InstallBy = atob(item.InstallBy || '') || '-';
        })

        res.json(jigs);
    } catch (err) {
        console.log('/support/jig/confirm', err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/jig/confirm/edit', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { PrepareID } = req.body;
        let UserID = req.session.UserID;

        let updateConfirm = `UPDATE [Jig].[Prepare] SET InstallStatus =
            CASE
                WHEN InstallStatus = 0 OR InstallStatus IS NULL THEN 1
                WHEN InstallStatus = 1 THEN 0
            END,
            InstallBy = ${UserID}, InstallTime = GETDATE()
        WHERE PrepareID = ${PrepareID}
        `;
        await pool.request().query(updateConfirm);

        let prepare = await pool.request().query(`DECLARE @DayOfPlan INT
        DECLARE @Planning_No NVARCHAR(50)
        DECLARE @MachineNo NVARCHAR(10)
        DECLARE @PlanDate NVARCHAR(10)
        DECLARE @InstallStatus NVARCHAR(1)
        DECLARE @Status NVARCHAR(1)

        SELECT @DayOfPlan = DAY(PlanDate), @Planning_No = Planning_No, @MachineNo = b.MachineNo, @PlanDate = CONVERT(NVARCHAR, a.PlanDate, 23),
        @InstallStatus = CONVERT(NVARCHAR(1), ISNULL(a.InstallStatus, 0)), @Status = CONVERT(NVARCHAR(1), ISNULL(a.Status, 0))
        FROM [Jig].[Prepare] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] b ON a.MachineID = b.MachineID
        WHERE PrepareID = ${PrepareID}

        DECLARE @ColumnName NVARCHAR(10)
        SET @ColumnName = 'D' + CAST(@DayOfPlan AS nvarchar(2))

        DECLARE @SQL NVARCHAR(MAX)
        SET @SQL = 'SELECT ' + QUOTENAME(@ColumnName) +' AS Sequence, '+ CONVERT(nvarchar(2), @DayOfPlan) + ' AS DayOfPlan, '''+ @MachineNo + ''' AS MachineNo, ''' + @PlanDate + ''' AS PlanDate, '''
        + @InstallStatus + ''' AS InstallStatus, ''' + @Status + ''' AS Status ' +' FROM [TSMolymer_F].[Planner].[Inject_Inj_Sheet] a
        WHERE a.ItemID = 19 AND Planning_No = ''' + @Planning_No + ''''
        EXEC(@SQL)
        `);
        let Plans = await pool.request().query(`SELECT a.Planning_No
        FROM [TSMolymer_F].[Planner].[Plan_Inject] a
        LEFT JOIN [TSMolymer_F].[Planner].[Inject_Inj_Sheet] b ON a.Planning_No = b.Planning_No
        WHERE b.ItemId = 19 AND a.Machine_No = '${prepare.recordset[0].MachineNo}' AND b.D${prepare.recordset[0].DayOfPlan} = '${prepare.recordset[0].Sequence}'
        `);

        //* handle OrderStatus
        if (log.recordset[0].InstallStatus == 1) { // Confirm
            var OrderStatus = 2;
        } else { // Unconfirm
            if (prepare.recordset[0].Status == 1) { // Ready
                var OrderStatus = 1;
            } else { // Issue & Reject
                var OrderStatus = 0;
            }
        }

        const JigItemID = 30;
        for (let plan of Plans.recordset) {
            UpdateOrder(plan.Planning_No, prepare.recordset[0].PlanDate, OrderStatus, JigItemID);
        }

        const io = req.app.get('socketio');
        io.emit('reload-tbJigConfirm');
        res.json({ message: 'Success' });
    } catch (err) {
        console.log('/support/jig/confirm/edit', err);
        res.status(500).send({ message: `${err}` });
    }
})

//* Daily Check Sheet
router.post('/daily', async (req, res) => {//TODO:
    try {
        let pool = await getPool('JigPool', config);
        let { JigID } = req.body;
        let dailyCheckSheet = await pool.request().query(`
        `);
        dailyCheckSheet.recordset.forEach(item => {
            item.CheckBy = !item.CheckBy ? '' : atob(item.CheckBy || '');
            item.ApprveBy = atob(item.ApprveBy || '');
        })

        res.json(dailyCheckSheet.recordset);
    } catch (err) {
        console.log('/support/jig', err);
        res.status(500).send({ message: `${err}` });
    }
})

//* Torque Check Sheet
router.post('/torque', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { JigID, month, year } = req.body;
        let torqueStd = await pool.request().query(`SELECT a.TorqueNo, a.Spec, a.ToleranceMin, a.ToleranceMax, a.Model, a.ProcessFileNo, a.UseScrew
        FROM [Jig].[MasterTorqueCheck] a
        WHERE a.JigID = ${JigID};
        `);
        let torqueCheckMonth = await pool.request().query(`SELECT a.MonthTorqueID, b.FirstName AS CheckBy, a.CheckTime, c.FirstName AS ApproveBy, a.ApproveTime
        FROM [Jig].[TorqueMonth] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.ApproveBy
        WHERE a.JigID = ${JigID} AND MONTH(a.CheckMonth) = ${month} AND YEAR(a.CheckMonth) = ${year};
        `);
        let torqueCheckSheet = await pool.request().query(`SELECT b.DailyTorqueID, b.CheckDate, b.CheckTime, b.OrderNo, b.Lot, b.ScrewEndWear, b.ActualTorque, b.Remark
        FROM [Jig].[TorqueMonth] a
        LEFT JOIN [Jig].[TorqueDaily] b ON b.MonthTorqueID = a.MonthTorqueID
        WHERE a.JigID = ${JigID} AND MONTH(a.CheckMonth) = ${month} AND YEAR(a.CheckMonth) = ${year};
        `);
        let std = {
            TorqueNo: null,
            Spec: null,
            ToleranceMin: null,
            ToleranceMax: null,
            Model: null,
            ProcessFileNo: null,
            UseScrew: null
        }
        let sign = {
            CheckBy: null,
            CheckTime: null,
            ApproveBy: null,
            ApproveTime: null,
            MonthTorqueID: null
        }
        if(torqueStd.recordset.length){
            std.TorqueNo = torqueStd.recordset[0].TorqueNo;
            std.Spec = torqueStd.recordset[0].Spec;
            std.ToleranceMin = torqueStd.recordset[0].ToleranceMin;
            std.ToleranceMax = torqueStd.recordset[0].ToleranceMax;
            std.Model = torqueStd.recordset[0].Model;
            std.ProcessFileNo = torqueStd.recordset[0].ProcessFileNo;
            std.UseScrew = torqueStd.recordset[0].UseScrew;
        }
        if(torqueCheckMonth.recordset.length){
            sign.CheckBy = atob(torqueCheckMonth.recordset[0].CheckBy || '');
            sign.ApproveBy = atob(torqueCheckMonth.recordset[0].ApproveBy || '');
            sign.CheckTime = torqueCheckMonth.recordset[0].CheckTime;
            sign.ApproveTime = torqueCheckMonth.recordset[0].ApproveTime;
            sign.MonthTorqueID = torqueCheckMonth.recordset[0].MonthTorqueID;
        }

        res.json({ std, sign, checkSheet: torqueCheckSheet.recordset });
    } catch (err) {
        console.log('/support/jig', err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/torque/add', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { MonthTorqueID, CheckDate, OrderNo, Lot, ScrewEndWear, ActualTorque, CheckTime, Remark } = req.body;
        let insertTorqueCheck = `INSERT INTO [Jig].[TorqueDaily](MonthTorqueID, CheckDate, CheckTime, OrderNo, Lot, ScrewEndWear, ActualTorque, Remark)
        VALUES(${MonthTorqueID}, '${CheckDate}', '${CheckTime}', N'${OrderNo}', N'${Lot}', ${ScrewEndWear}, ${ActualTorque}, N'${Remark}');
        `;
        await pool.request().query(insertTorqueCheck);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log('/support/jig', err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/torque/sign/check', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { MonthTorqueID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Jig].[TorqueMonth] SET CheckBy = ${CheckBy}, CheckTime = '${curStr}' WHERE MonthTorqueID = ${MonthTorqueID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/torque/sign/approve', async (req, res) => {
    try {
        let pool = await getPool('JigPool', config);
        let { MonthTorqueID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Jig].[TorqueMonth] SET ApproveBy = ${ApproveBy}, CheckTime = '${curStr}' WHERE MonthTorqueID = ${MonthTorqueID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;