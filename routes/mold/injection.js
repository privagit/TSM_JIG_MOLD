const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const { getPool } = require('../../middlewares/pool-manager');
const Redis = require('ioredis');
const redis = new Redis();

router.post('/', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MachineID } = req.body;
        let getEmCall = await pool.request().query(`SELECT a.EmMachineID, a.MachineTypeID, a.MachineModel, b.EmCallID
        FROM [Em].[MasterEmMachine] a
        LEFT JOIN [Em].[EmCall] b ON a.EmMachineID = b.EmMachineID AND b.CheckInAt IS NULL
        WHERE a.MachineID = ${MachineID} AND a.Active = 1;
        `);
        res.json(getEmCall.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/call', async (req, res) => { //*  cache, io
    try {
        let pool = await getPool('MoldPool', config);
        let { MachineID, EmployeeID } = req.body;

        // Check Employee
        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        // Check Already Call
        let checkCall = await pool.request().query(`DECLARE @EmMachineID INT;
        SELECT @EmMachineID = EmMachineID
        FROM [Em].[MasterEmMachine]
        WHERE MachineID = ${MachineID} AND Active = 1;

        SELECT EmCallID FROM [Em].[EmCall] WHERE EmMachineID = @EmMachineID AND CheckInAt IS NULL;
        `);
        if(checkCall.recordset.length) return res.status(400).send({ message: 'มีการ Call ไปแล้ว' });

        let insertCall = `DECLARE @EmMachineID INT,
        @EmCallID INT;
        SELECT @EmMachineID = EmMachineID
        FROM [Em].[MasterEmMachine]
        WHERE MachineID = ${MachineID} AND Active = 1;

        INSERT INTO [Em].[EmCall](EmMachineID, CreatedAt, CallBy)
        VALUES(@EmMachineID, GETDATE(), ${EmployeeID});

        SELECT @EmCallID = SCOPE_IDENTITY();

        SELECT MachineNo, @EmCallID AS EmCallID FROM [TSMolymer_F].[dbo].[MasterMachine] WHERE MachineID = ${MachineID};
        `;
        let machine = await pool.request().query(insertCall);

        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let alertLog = { MachineNo: machine.recordset[0]?.MachineNo, Module: 4, Action: 4, time: alertTime, date: alertDate };
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


        if(getUser.recordset.length) {
            getUser.recordset[0].CallEMName = !getUser.recordset[0].FirstName ? '': atob(getUser.recordset[0].FirstName);
        }

        res.json({ message: 'Success', User: getUser.recordset, EmCallID: machine.recordset[0]?.EmCallID });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/checkin', async (req, res) => { //* cache, io
    try {
        let pool = await getPool('MoldPool', config);
        let { EmCallID, Reason, MachineID, EmployeeID } = req.body;

        // Check Employee
        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${EmployeeID};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let insertCall = `UPDATE [Em].[EmCall] SET Reason = N'${Reason}', CheckInAt = GETDATE(), CheckInBy = '${EmployeeID}'
        WHERE EmCallID = ${EmCallID};

        SELECT MachineNo FROM [TSMolymer_F].[dbo].[MasterMachine] WHERE MachineID = ${MachineID};
        `;
        let machine = await pool.request().query(insertCall);

        let date = new Date();
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        const io = req.app.get('socketio');
        let alertLog = { MachineNo: machine.recordset[0]?.MachineNo, Module: 4, Action: 5, time: alertTime, date: alertDate, CheckInName: !getUser.recordset[0].FirstName ? '': atob(getUser.recordset[0].FirstName) };
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

        if(getUser.recordset.length) {
            getUser.recordset[0].CheckInName = !getUser.recordset[0].FirstName ? '': atob(getUser.recordset[0].FirstName);
        }

        res.json({ message: 'Success', User: getUser.recordset });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair', async (req, res) => { //TODO: Insert, cache, io, RunningNo
    try {
        let pool = await getPool('MoldPool', config);
        let { MachineID, RequestBy, RequestTime, Shift, Complaint, Type, RepairTypeID ,RepairProblemID } = req.body;

        //* Get RunningNo
        let date = new Date();
        let monthRunningNo = await pool.request().query(`SELECT a.MonthDate, a.PreventRunningNo, a.PredictRunningNo, a.RepairRunningNo
        FROM [MonthRunningNo] a
        WHERE Month(MonthDate) = ${date.getMonth()+1} AND YEAR(MonthDate) = ${date.getFullYear()};
        `);
        if(monthRunningNo.recordset.length){
            var RunningNo = monthRunningNo.recordset[0].RepairRunningNo + 1;
            await pool.request().query(`UPDATE [MonthRunningNo] SET RepairRunningNo = ${RunningNo} WHERE Month(MonthDate) = ${date.getMonth()+1} AND YEAR(MonthDate) = ${date.getFullYear()};`);
        } else{
            var RunningNo = 1;
            await pool.request().query(`INSERT INTO [MonthRunningNo](MonthDate, RepairRunningNo) VALUES('${date.getFullYear()}-${date.getMonth()+1}-1', 1)`);
        }
        let ReportNo = `RP-${('0000'+RunningNo).substr(-4)}-${('00'+(date.getMonth()+1)).substr(-2)}-${date.getFullYear().toString().substr(-2)}`;

        let issueRepair = `DECLARE @EmMachineID INT;
        SELECT @EmMachineID = EmMachineID
        FROM [Em].[MasterEmMachine]
        WHERE MachineID = ${MachineID} AND Active = 1;

        IF(@EmMachineID IS NOT NULL)
        BEGIN
            INSERT INTO [Em].[RepairCheck](EmMachineID, AccessoryID, RequestBy, RequestTime, Shift, Complaint, Type, RepairTypeID ,RepairProblemID, ReportNo, MachineTypeID)
            VALUES(@EmMachineID, null, N'${RequestBy}', '${RequestTime}', '${Shift}', N'${Complaint}', ${Type}, ${RepairTypeID} ,${RepairProblemID}, '${ReportNo}', 1);
        END;

        SELECT MachineNo FROM [TSMolymer_F].[dbo].[MasterMachine] WHERE MachineID = ${MachineID};
        `;
        let machine = await pool.request().query(issueRepair);

        // io
        // let date = new Date();
        const io = req.app.get('socketio');
        let alertTime = `${date.getHours()}:${('00'+date.getMinutes()).substr(-2)}`;
        let alertDate = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
        let alertLog = { MachineNo: machine.recordset[0]?.MachineNo, Module: 4, Action: 1, time: alertTime, date: alertDate };
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

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router