const config = require('../lib/dbconfig');
const sql = require('mssql');
const cron = require('node-cron');

let insertPredictPlan = async () => { //TODO:
    try {
        console.log('start Predict', new Date());
        let pool = await sql.connect(config);
        let date = new Date();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();

        //* Get RunningNo
        let monthRunningNo = await pool.request().query(`SELECT a.MonthDate, a.RunningNo
        FROM [MonthRunningNo] a
        WHERE Month(MonthDate) = ${date.getMonth()+1} AND YEAR(MonthDate) = ${date.getFullYear()};
        `);
        if(monthRunningNo.recordset.length){
            var RunningNo = monthRunningNo.recordset[0].PreventRunningNo + 1;
        } else{
            var RunningNo = 1;
            await pool.request().query(`INSERT INTO [MonthRunningNo](MonthDate) VALUES('${year}-${month}-1')`);
        }

        //* Get Machine
        let machines = await pool.request().query(`WITH EmMachine AS (
            SELECT a.EmMachineID, a.MachineTypeID, c.Month, c.Quarter, c.Biannaul, c.Year, b.MonthDay, b.QuarterDay, b.QuarterMonth, b.BiannualDay, b.BiannualMonth, b.YearDay, b.YearMonth
            FROM [Em].[MasterEmMachine] a
            LEFT JOIN [Em].[MasterPredictDate] b ON a.EmMachineID = b.EmMachineID
            LEFT JOIN [Em].[MasterPredictFreq] c ON a.MachineGroupID = c.MachineGroupID
            WHERE a.Active = 1
        ), AccMachine AS (
            SELECT a.AccessoryID, a.MachineTypeID, c.Month, c.Quarter, c.Biannaul, c.Year, b.MonthDay, b.QuarterDay, b.QuarterMonth, b.BiannualDay, b.BiannualMonth, b.YearDay, b.YearMonth
            FROM [Em].[MasterAccessory] a
            LEFT JOIN [Em].[MasterPredictDate] b ON a.AccessoryID = b.AccessoryID
            LEFT JOIN [Em].[MasterPredictFreq] c ON a.MachineGroupID = c.MachineGroupID
            WHERE a.Active = 1
        )
        SELECT EmMachineID, NULL AS AccessoryID, MachineTypeID, Month, Quarter, Biannaul, Year, MonthDay, QuarterDay, QuarterMonth, BiannualDay, BiannualMonth, YearDay, YearMonth
        FROM [EmMachine]
        UNION ALL
        SELECT NULL AS EmMachineID, AccessoryID, MachineTypeID, Month, Quarter, Biannaul, Year, MonthDay, QuarterDay, QuarterMonth, BiannualDay, BiannualMonth, YearDay, YearMonth
        FROM [AccMachine]
        `);
        let totalQuery = [];
        let QuaterMap = { 1: [1,5,9], 2: [2,6,10], 3: [3,7,11], 4: [4,8,12] };
        let BiaanualMap = { 1: [1,7], 2: [2,8], 3: [3,9], 4: [4,10], 5: [5,11], 6: [6,12] };
        for(let mc of machines.recordset){
            //* Declare Parameter
            let MonthDay = mc.MonthDay;
            let QuarterDay = mc.QuarterDay;
            let QuarterMonth = mc.QuarterMonth; // {1: 1,5,9}, {2: 2,6,10}, {3: 3,7,11}, {4: 4,8,12}
            let BiannualDay = mc.BiannualDay;
            let BiannualMonth = mc.BiannualMonth; // {1: 1,7}, {2: 2,8}, {3: 3,9}, {4: 4,10}, {5: 5:11}, {6: 6:12}
            let YearDay = mc.YearDay;
            let YearMonth = mc.YearMonth;

            //* Map Quarter & Annual
            let QuarterFilter = !QuarterMonth ? [] : QuaterMap[QuarterMonth].filter(v => v == month);
            let BiannualFilter = !BiannualMonth ? [] : BiaanualMap[BiannualMonth].filter(v => v == month);

            if(MonthDay){ // Month
                let Planning_No = `EM-${('0000'+RunningNo).substr(-4)}-${('00'+ month).substr(-2)}-${year.toString().substr(-2)}`;
                let insertPredict = `INSERT INTO [Em].[PredictPlan](EmMachineID, AccessoryID, MachineTypeID, PlanDate, Planning_No)
                VALUES(${mc.EmMachineID || null}, ${mc.AccessoryID || null}, ${mc.MachineTypeID}, '${year}-${month}-${MonthDay}', '${Planning_No}');
                `;
                totalQuery.push(insertPredict);
                RunningNo++;
            }
            if(QuarterFilter.length){ // Quarter
                let Planning_No = `EM-${('0000'+RunningNo).substr(-4)}-${('00'+ month).substr(-2)}-${year.toString().substr(-2)}`;
                let insertPredict = `INSERT INTO [Em].[PredictPlan](EmMachineID, AccessoryID, MachineTypeID, PlanDate, Planning_No)
                VALUES(${mc.EmMachineID || null}, ${mc.AccessoryID || null}, ${mc.MachineTypeID}, '${year}-${month}-${QuarterDay}', '${Planning_No}');
                `;
                totalQuery.push(insertPredict);
                RunningNo++;
            }
            if(BiannualFilter.length){ // Biannual
                let Planning_No = `EM-${('0000'+RunningNo).substr(-4)}-${('00'+ month).substr(-2)}-${year.toString().substr(-2)}`;
                let insertPredict = `INSERT INTO [Em].[PredictPlan](EmMachineID, AccessoryID, MachineTypeID, PlanDate, Planning_No)
                VALUES(${mc.EmMachineID || null}, ${mc.AccessoryID || null}, ${mc.MachineTypeID}, '${year}-${month}-${BiannualDay}', '${Planning_No}');
                `;
                totalQuery.push(insertPredict);
                RunningNo++;
            }
            if(YearMonth == month){ // Year
                let Planning_No = `EM-${('0000'+RunningNo).substr(-4)}-${('00'+ month).substr(-2)}-${year.toString().substr(-2)}`;
                let insertPredict = `INSERT INTO [Em].[PredictPlan](EmMachineID, AccessoryID, MachineTypeID, PlanDate, Planning_No)
                VALUES(${mc.EmMachineID || null}, ${mc.AccessoryID || null}, ${mc.MachineTypeID}, '${year}-${month}-${YearDay}', '${Planning_No}');
                `;
                totalQuery.push(insertPredict);
                RunningNo++;
            }

        }
        let updateRunningNo = `UPDATE [MonthRunningNo] SET PreventRunningNo = ${RunningNo} WHERE MONTH(MonthDate) = ${month} AND YEAR(MonthDate) = ${year};`;
        await pool.request().query(totalQuery.join(''));
        await pool.request().query(updateRunningNo);
        console.log('finish Predict', new Date());
    } catch (err) {
        console.log('insertPredictPlan', err);
    }
}

let insertSpareMonth = async () => { // New Month: insert new [SpareMonth] and Remain is BF
    try {
        console.log('start insertSpareMonth', new Date());
        let pool = await sql.connect(config);
        let spare = await pool.request().query(`
        WITH SpareReceive AS(
            SELECT a.SpareID, a.BF, a.Received, a.Purchase
            FROM [Em].[SpareMonth] a
            WHERE MONTH(DATEADD(MONTH, 1, a.MonthYear)) = MONTH(GETDATE()) AND YEAR(DATEADD(MONTH, 1, a.MonthYear)) = YEAR(GETDATE())
        ), SpareUsed AS (
            SELECT a.SpareID, SUM(a.Qty) AS Used
            FROM [Em].[RepairCost] a
            WHERE MONTH(DATEADD(MONTH, 1, a.UsedDate)) = MONTH(GETDATE()) AND YEAR(DATEADD(MONTH, 1, a.UsedDate)) = YEAR(GETDATE())
            GROUP BY a.SpareID
        )
        SELECT a.SpareID, b.BF, b.Received, b.Purchase, c.Used, d.SpareMonthID
        FROM [Em].[MasterSpare] a
        LEFT JOIN [SpareReceive] b ON a.SpareID = b.SpareID
        LEFT JOIN [SpareUsed] c ON a.SpareID = c.SpareID
        LEFT JOIN [Em].[SpareMonth] d ON a.SpareID = d.SpareID AND MONTH(d.MonthYear) = MONTH(GETDATE()) AND YEAR(d.MonthYear) = YEAR(GETDATE());
        `);
        let totalQuery = [];
        for(let item of spare.recordset){
            let BF = item.BF + item.Received + item.Purchase - item.Used;
            if(item.SpareMonthID) continue;

            let insertSpareMonth = `INSERT INTO [Em].[SpareMonth](SpareID, MonthYear, BF) VALUES(${item.SpareID}, GETDATE(), ${BF});
            `;
            totalQuery.push(insertSpareMonth);
        }
        // await pool.request().query(totalQuery.join(''));
        console.log('finish insertSpareMonth', new Date());
    } catch (err) {
        console.log('insertSpareMonth', err);
    }
}

// cron.schedule('0 8 1 * *', async () => {
//     try {
//         console.log('day 1 EM', new Date());
//         await insertSpareMonth();
//         await insertPredictPlan();
//         console.log('finish day 1 EM', new Date());
//     } catch (err) {
//         console.log('updateSpare', err);
//     }
// })





