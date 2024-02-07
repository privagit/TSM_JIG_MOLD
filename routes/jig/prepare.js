const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');

const UpdateOrder = async (Planning_No, PlanDate, OrderStatus, ItemID) => {
    try {
        let pool = await sql.connect(config);
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
        let pool = await sql.connect(config);
        let { ProductionDate, Shift, ZoneID, MachineID, Status } = req.body;
        let selectJigs = await pool.request().query(`SELECT row_number() over(order by a.PrepareID desc) as 'index',
        a.PrepareID, e.MachineID, e.MachineNo, e.ZoneID, f.JigNo, c.FirstName AS PrepareBy, a.Status, d.FirstName AS InstallBy, a.InstallStatus,
        a.Shift, CONVERT(VARCHAR, a.PrepareDateTime, 23) AS PrepareDate, CONVERT(VARCHAR(5), a.PrepareDateTime, 108) AS PrepareTime,
        CONVERT(VARCHAR, a.ProductionDateTime, 23) AS ProductionDate, CONVERT(VARCHAR(5), a.ProductionDateTime, 108) AS ProductionTime,
        CONVERT(VARCHAR(5), a.InstallTime, 108) AS InstallTime, a.Tube, a.DailyCheck, a.Dummy, a.Remark,
        CONVERT(VARCHAR(5), a.ReadyTime, 108) AS ReadyTime
        FROM [Jig].[Prepare] a
        LEFT JOIN [TSMolymer_F].[Planner].[Plan_Inject] b ON a.Planning_No = b.Planning_No
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.PrepareBy = c.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.InstallBy = d.UserID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] e ON a.MachineID = e.MachineID
        LEFT JOIN [Jig].[MasterJig] f ON f.JigID = a.JigID
        WHERE CONVERT(VARCHAR, a.ProductionDateTime, 23) = '${ProductionDate}';
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
router.post('/jig/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
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
router.post('/jig/confirm', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
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
router.post('/jig/confirm/edit', async (req, res) => { //TODO: test
    try {
        let pool = await sql.connect(config);
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
router.post('/daily', async (req, res) => {
    try {
        let pool = await sql.connect(config);
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
        let pool = await sql.connect(config);
        let { JigID } = req.body;
        let torqueCheckSheet = await pool.request().query(`
        `);
        torqueCheckSheet.recordset.forEach(item => {
            item.CheckBy = atob(item.CheckBy || '');
            item.ApprveBy = atob(item.ApprveBy || '');
        })

        res.json(torqueCheckSheet.recordset);
    } catch (err) {
        console.log('/support/jig', err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;