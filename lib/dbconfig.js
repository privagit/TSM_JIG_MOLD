require("dotenv").config();

const { SQL_USER, SQL_PASSWORD, SQL_DATABASE_JIG, SQL_DATABASE_MOLD, SQL_SERVER, SQL_PORT } = process.env;

const dbconfig_jig = {
    user: SQL_USER,
    password: SQL_PASSWORD,
    server: SQL_SERVER,
    database: SQL_DATABASE_JIG,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        trustedConnection: true,
    },
};

const dbconfig_mold = {
    user: SQL_USER,
    password: SQL_PASSWORD,
    server: SQL_SERVER,
    database: SQL_DATABASE_MOLD,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        trustedConnection: true,
    },
};

module.exports = { dbconfig_jig, dbconfig_mold };
