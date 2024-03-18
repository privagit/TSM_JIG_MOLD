const config_jig = require('../lib/dbconfig').dbconfig_jig;
const config_mold = require('../lib/dbconfig').dbconfig_mold;
const cron = require('node-cron');
const { getPool } = require('../middlewares/pool-manager');
const EMAIL = process.env.EMAIL;

const insertPmJig = async () => { //TODO:
    try {
        console.log('start Predict', new Date());
        let pool = await getPool('JigPool', config_jig);
        let date = new Date('2024-03-01');
        // let date = new Date();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();

        let weekDay = [];
        while(date.getMonth() + 1 === month){ // get Monday date of month
            if(date.getDay() == 1){
                weekDay.push(`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`);
            }
            date.setDate(date.getDate() + 1);
        }
        if(weekDay.length == 4) weekDay.push(weekDay[3]);

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
        let jigs = await pool.request().query(`SELECT a.JigID, b.Week
        FROM [Jig].[MasterJig] a
        LEFT JOIN [Jig].[MasterPm] b ON a.JigID = b.JigID
        WHERE a.Active = 1;
        `);
        let totalQuery = [];

        //* Loop Week
        for(let i = 0; i < weekDay.length; i++){
            let PlanDate = weekDay[i];
            let jigFiltered = jigs.recordset.filter(v => v.Week == i+1);
            for(let jig of jigFiltered){
                let PmPlanNo = `PM-${('0000'+RunningNo).substr(-4)}-${('00'+ month).substr(-2)}-${year.toString().substr(-2)}`;
                totalQuery.push(`(${jig.JigID}, '${PlanDate}', '${PmPlanNo}')
                `);

                RunningNo++;
            }
        }
        let insertPmPlan = `INSERT INTO [Jig].[PmPlan](JigID, PlanDate, PmPlanNo) VALUES` + totalQuery.join(',');
        let updateRunningNo = `UPDATE [MonthRunningNo] SET PreventRunningNo = ${RunningNo} WHERE MONTH(MonthDate) = ${month} AND YEAR(MonthDate) = ${year};`;
        console.log(insertPmPlan);
        console.log(updateRunningNo);

        return

        // await pool.request().query('INSERT INTO [Jig].[PmPlan](JigID, PlanDate, PmPlanNo)',totalQuery.join(''));
        await pool.request().query(updateRunningNo);
        console.log('finish Predict', new Date());
    } catch (err) {
        console.log('insertPredictPlan', err);
    }
}
// insertPmJig();

const insertSpareMonthJig = async () => { // New Month: insert new [SpareMonth] and Remain is BF
    try {
        console.log('start insertSpareMonth', new Date());
        let pool = await getPool('JigPool', config_jig);
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

const insertSpareMonthMold = async () => { // New Month: insert new [SpareMonth] and Remain is BF
    try {
        console.log('start insertSpareMonth', new Date());
        let pool = await getPool('MoldPool', config_mold);
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

const alertShot = async () => {
    try {
        let pool = await getPool('MoldPool', config_mold);
        let molds = await pool.request().query(`SELECT a.MoldID, c.BasicMold, c.DieNo, a.ActualPmShot, a.ActualWarrantyShot,
        b.WarningShot, b.WarrantyWarningShot, b.AlertPercent, b.AlertWarrantyPercent
        FROM [Mold].[MoldShot] a
        LEFT JOIN [Mold].[MasterPm] b ON b.MoldID = a.MoldID
        LEFT JOIN [Mold].[MasterMold] c ON c.MoldID = a.MoldID
        `);

        let moldList = [];
        for(let mold of molds.recordset){
            let pmShot = mold.ActualPmShot;
            let warrantyShot = mold.ActualWarrantyShot;
            let alertPm = mold.AlertPercent;
            let alertWarranty = mold.AlertWarrantyPercent;
            let pmWarningShot = mold.WarningShot;
            let warrantyWarningShot = mold.WarrantyWarningShot;

            let alertShot = pmWarningShot * alertPm;
            let alertWarrantyShot = warrantyWarningShot * alertWarranty;

            let arrMold = [];
            if(pmShot >= alertShot || warrantyShot >= alertWarrantyShot){
                arrMold.push(`<tr><td>${mold.BasicMold}</td><td>${mold.DieNo}</td><td>${mold.ActualPmShot}</td><td>${mold.WarningShot}</td><td>${mold.AlertPercent}</td></tr>`);
            }
        }
    } catch (err) {
        console.log('alertShot', err);
    }
}

const sendMail = async (text) => {
    try{
        let transporter = nodemailer.createTransport({
            host: EMAIL.host,
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: EMAIL.email, //  user
              pass: EMAIL.ps, //  password
            },
            // debug: true, // show debug output
            // logger: true // log information in console
        });

        let html = `
        <h3>Updated Plan</h3>
        <div class="table-responsive">
        <table  style="width: 50%;">
            <thead>
                <tr>
                    <th>BasicMold</th>
                    <th>DieNo</th>
                    <th>ActualShot</th>
                    <th>WarningShort</th>
                    <th>AlertPercent</th>
                </tr>
            </thead>
            <tbody >
                <tr class="text-center">
                ${text}
                </tr >
                </tbody>
        </table>
        </div>
        `;

        let info = await transporter.sendMail({
            from: `"Injection Planning" <${mail.sender.email}>`, // sender address
            to: mail.receiversAuto, // list of receivers
            subject: "Updated Plan", // Subject line
            html: html, // html body
        });
    } catch(err){
        console.log('sendMail', err);
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



