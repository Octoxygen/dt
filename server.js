import express from "express";
import mysql from "mysql";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import crypto from "crypto"
// import path from 'path';
// import { fileURLToPath } from 'url';

dotenv.config()

const app = express();

// const __filename = fileURLToPath(import.meta.url);

// const __dirname = path.dirname(__filename);

app.use(express.json())
app.use(cors())

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", process.env.REQ_URL); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// app.use(express.static(path.join(__dirname, 'dist')));

const db = mysql.createConnection({
    host: process.env.DB_HOST, // "localhost"
    user: process.env.DB_USER, // "root"
    database: process.env.DB_NAME, // "docutracker"
    password: process.env.DB_PASS,
})

const getDateToday = () => {
    let date = new Date()
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, 0)
    const day = (date.getDate()).toString().padStart(2, 0)
    return {
        std: year + "-" + month + "-" + day,
        pref: year + "-" + month + day,
    }
}

const generateID = (seq) => {
    return getDateToday().pref + "-" + seq.toString().padStart(3, 0)
}

app.get("/", (req, res) => {
    res.json("hello i am data")
    console.log(process.env.DB_HOST)
    console.log(process.env.DB_HOST)
    console.log(process.env.DB_USER)
})

// app.get('/*', function (req, res) {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// })

app.get("/users", (req, res) => {
    const q = "SELECT COUNT(document_id) as 'count' from `documents`";
    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        console.log(process.env.DB_NAME)
        console.log(process.env.DB_HOST)
        console.log(process.env.DB_USER)
        if (err) return res.json(err);
        return res.json(data[0].count);
    })
})

app.post("/validate-credentials", (req, res) => {
    const in_username = req.body.username;
    const in_password = req.body.password;

    var q = "SELECT password FROM users WHERE (username = '" + in_username + "' OR email =  '" + in_username + "')"

    var pass = true

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        if (data.length != 1) {
            console.log('user not found')
            pass = false
            return res.json({
                err: { username: true, password: false },
            });
        } else {
            const get_pass = data[0].password
            if (get_pass != in_password) {
                console.log('incorrect password')
                pass = false
                return res.json({
                    err: { username: false, password: true },
                });
            } else {
                console.log('credentials valid')
                return res.json({
                    err: { username: false, password: false },
                });
            }
        }
    })
})

app.post("/login", (req, res) => {
    const in_username = req.body.username;
    const in_password = req.body.password;

    var q = "SELECT u.*, d.name as 'location' FROM `users` u JOIN departments d ON d.department_id = u.department_id WHERE (username = '" + in_username + "' OR email =  '" + in_username + "') AND password = '" + in_password + "'"

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json({
            test: data.length == 1 ? true : false,
            data,
        });
    })
})

app.get("/check-email/:email", (req, res) => {
    const email = req.params.email

    const q = "SELECT user_id FROM users WHERE email = ?"

    db.query(q, [email], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data);
    })
})

app.post("/check-requests", (req, res) => {
    const uid = req.body.uid

    const q = "SELECT COUNT(req_id) AS 'count' FROM requests WHERE user_id = ?"

    db.query(q, [uid], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data);
    })
})

app.post("/create-request", (req, res) => {
    const uid = req.body.uid

    const issued_at = new Date()
    const raw_expires_at = new Date(issued_at.getTime() + 10 * 60000)
    const expires_at = new Date(raw_expires_at.getTime() + 2.88e+7)

    const key = crypto.randomUUID()

    const q = "INSERT INTO requests (user_id, request_key, expires_at) VALUES (?, ?, STR_TO_DATE(?,'%Y-%m-%dT%T.%fZ'));;"

    db.query(q, [uid, key, expires_at.toISOString()], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(key);
    })
})

app.post("/get-request", (req, res) => {
    const uid = req.body.uid

    const q = "SELECT expires_at FROM requests WHERE user_id = ?"

    db.query(q, [uid], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data);
    })
})

app.post("/delete-request", (req, res) => {
    const uid = req.body.uid

    const q = "DELETE FROM `requests` WHERE `requests`.`user_id` = ?"

    console.log('deleting request')
    db.query(q, [uid], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data);
    })
})

app.post("/validate-request", (req, res) => {
    const key = req.body.key

    const q = "SELECT r.*, CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) AS 'name' FROM requests r JOIN users u ON u.user_id = r.user_id WHERE r.request_key = ?"

    db.query(q, [key], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data);
    })
})

app.post("/change-password", (req, res) => {
    const uid = req.body.uid
    const newPass = req.body.newPass

    var q = "UPDATE users SET password = ? WHERE user_id = ?"

    db.query(q, [newPass, uid], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    const msg = '[' + req.body.name + '] changed their password.'

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Change Password', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(true)
    })
})

app.post("/send-pw-change-mail", (req, res) => {
    const email = req.body.email
    const link = req.body.key;

    let config = {
        service: 'gmail',
        auth: {
            user: process.env.M_MAIL,
            pass: process.env.M_PASS
        }
    }

    let transporter = nodemailer.createTransport(config)

    let message = {
        from: process.env.M_MAIL,
        to: email,
        subject: "Docutracker Password Change",
        text: `Good day!

To change your password, click the following link:
` + process.env.TRACKING_BASE_URL + `passwordReset/` + link + `
        
The link will only be active for 10 minutes. After which, you need to make another request to change your password. If you did note make this request, you may ignore this message.

Thank you!`
    }

    transporter.sendMail(message).then((info) => {
        return res.json({
            msg: "email sent",
            info: info.messageId,
        })
    }).catch(err => {
        console.log("ERROR!")
        return res.json(err)
    })
})

app.get("/generate-id", (req, res) => {
    const today = getDateToday()

    const q = "SELECT COUNT(document_id) as 'count' from `documents` WHERE `date_id_generated` >= ?"

    db.query(q, [today.std], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data[0].count);
    })
})

app.post("/add-draft", (req, res) => {
    const seq = req.body.seq
    console.log(seq)
    const id = generateID(seq)

    console.log(id)

    const q = "INSERT INTO `documents` (`document_id`, `creator`) VALUES (?)"
    const val = [
        id,
        req.body.user
    ]

    db.query(q, [val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(id);
    })
})

app.put("/publish", (req, res) => {
    const q = "UPDATE `documents` SET `document_title` = ?, `status` = ? WHERE `document_id` = ?"

    const val = [
        req.body.title,
        'pub',
        req.body.id
    ]

    db.query(q, [...val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json("Document added successfully!");
    })
})

app.post("/add-initial-transfer", (req, res) => {
    const uid = req.body.uid

    var q = "INSERT INTO `transfer_history` (`document_id`, `transfer_department_id`, `received_by`) VALUES (?)"

    const val = [
        req.body.id,
        req.body.origin,
        req.body.creator
    ]

    const msg = '[' + req.body.uname + '] added a new document [' + val[0] + '].'

    db.query(q, [val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Add New Document', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.post("/transfer", (req, res) => {
    const uid = req.body.uid

    const complete = req.body.complete

    var q = "INSERT INTO `transfer_history` (`document_id`, `transfer_department_id`, `received_by`, `completed`) VALUES (?)"

    const val = [
        req.body.id,
        req.body.origin,
        req.body.creator,
        complete ? 'C' : 'N'
    ]

    console.log(val)

    console.log('logging')
    const msg = '[' + req.body.uname + '] ' + (complete ? 'completed' : 'received') + ' the document [' + val[0] + '].'

    console.log('TRANSFER 1')

    db.query(q, [val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Receive Document', ?)"

    console.log('TRANSFER 2')

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        console.log('logging')
        if (err) {
            console.log('error')
            console.log(err)
            return res.json(err)
        };
        console.log('good')
        console.log(data)
        return res.json(data)
    })
})

// app.get("/get-user-documents/:user", (req, res) => {
//     const user = req.params.user

//     console.log(user)

//     var q = "DROP TEMPORARY TABLE IF EXISTS a;"
//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     var q = "DROP TEMPORARY TABLE IF EXISTS b;"
//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     var q = "CREATE TEMPORARY TABLE a SELECT th.document_id from transfer_history th INNER JOIN ( SELECT document_id FROM `transfer_history` WHERE received_by = ? GROUP BY document_id ) dx ON th.document_id = dx.document_id GROUP BY th.document_id;"
//     db.query(q, [user], (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     var q = "CREATE TEMPORARY TABLE b SELECT MAX(th.transfer_id) AS transfer_id, document_id FROM transfer_history th GROUP BY th.document_id ASC;"
//     db.query(q, [user], (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     q = "SELECT b.transfer_id, b.document_id, th.transfer_department_id, dp.name as 'location', th.received_by, CONCAT(tu.name_given, ' ', IF(LENGTH(tu.name_middle_initial), tu.name_middle_initial, ''), IF(LENGTH(tu.name_middle_initial), '. ', ''), tu.name_last) as 'receiver', th.date_received, d.document_title, d.date_created, d.creator, CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) as 'name', th.completed FROM a INNER JOIN b ON a.document_id = b.document_id INNER JOIN transfer_history th ON th.transfer_id = b.transfer_id INNER JOIN documents d on d.document_id = b.document_id INNER JOIN users u on d.creator = u.user_id INNER JOIN users tu on tu.user_id = th.received_by INNER JOIN departments dp on dp.department_id = th.transfer_department_id ORDER BY th.date_received DESC;"

//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//         return res.json(data)
//     })
// })

app.get("/get-user-documents/:user", (req, res) => {
    const q = `SELECT 
	b.transfer_id, 
    b.document_id, 
    th.transfer_department_id, 
    dp.name as 'location', 
    th.received_by, 
    CONCAT(tu.name_given, ' ', IF(LENGTH(tu.name_middle_initial), tu.name_middle_initial, ''), IF(LENGTH(tu.name_middle_initial), '. ', ''), tu.name_last) as 'receiver', 
    th.date_received, 
    d.document_title, 
    d.date_created, 
    d.creator, 
    CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) as 'name', 
    th.completed 

    FROM (
        SELECT th.document_id 
        FROM transfer_history th 
        INNER JOIN (
            SELECT document_id 
            FROM transfer_history 
            WHERE received_by = 3 GROUP BY document_id) dx 
        ON th.document_id = dx.document_id 
        GROUP BY th.document_id
    ) AS a

    INNER JOIN (
        SELECT 
            MAX(th.transfer_id) AS transfer_id, 
            document_id 
        FROM transfer_history th 
        GROUP BY th.document_id 
        ORDER BY th.document_id ASC
    ) AS b ON a.document_id = b.document_id 

    INNER JOIN transfer_history th
    ON th.transfer_id = b.transfer_id 

    INNER JOIN documents d 
    ON d.document_id = b.document_id 

    INNER JOIN users u 
    ON d.creator = u.user_id 

    INNER JOIN users tu 
    ON tu.user_id = th.received_by 

    INNER JOIN departments dp 
    ON dp.department_id = th.transfer_department_id 

    ORDER BY th.date_received DESC;`;

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

// app.get("/get-all-documents", (req, res) => {
//     var q = "DROP TEMPORARY TABLE IF EXISTS latest_dates;"
//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     var q = "CREATE TEMPORARY TABLE latest_dates SELECT * FROM transfer_history th GROUP BY th.document_id DESC;"
//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//     })

//     q = "SELECT d.document_id, d.document_title, d.date_created, d.creator, CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) as 'name', dp.name AS 'location', ld.received_by, ld.completed FROM documents d INNER JOIN latest_dates ld USING(document_id) INNER JOIN departments dp ON ld.transfer_department_id = dp.department_id INNER JOIN users u ON d.creator = u.user_id ORDER BY d.date_created DESC;"

//     db.query(q, (err, data) => {
//         res.set('Access-Control-Allow-Origin', '*')
//         if (err) return res.json(err);
//         return res.json(data)
//     })
// })

app.get("/get-all-documents", (req, res) => {
    var q = `SELECT 
        d.document_id,
        d.document_title,
        d.date_created,
        d.creator,
        CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) as 'name',
        dp.name AS 'location',
        th.received_by,
        th.completed

    FROM documents d

    INNER JOIN (SELECT * 
        FROM transfer_history th 
        GROUP BY th.document_id
        ORDER BY th.document_id DESC) 
    AS th ON d.document_id = th.document_id

    LEFT JOIN departments dp ON th.transfer_department_id = dp.department_id

    LEFT JOIN users u ON d.creator = u.user_id

    ORDER BY d.date_created DESC;`

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-history/:id", (req, res) => {
    const id = req.params.id
    var docu_name;
    var pass = true;

    var q = "SELECT document_title FROM documents WHERE document_id = ?"

    db.query(q, id, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        if (data.length > 0) {
            docu_name = data[0].document_title
        } else {
            pass = false
        }
    })

    if (!pass) return

    var q = `SELECT 
        th.completed, 
        th.transfer_id, 
        th.received_by,
        CONCAT(u.name_given, ' ', IF(LENGTH(u.name_middle_initial), u.name_middle_initial, ''), IF(LENGTH(u.name_middle_initial), '. ', ''), u.name_last) as 'name', 
        th.date_received, 
        dc.name AS 'location', 
        LAG(th.date_received, 1) OVER (ORDER BY th.date_received) AS 'date_departed' 

    FROM transfer_history th 
    INNER JOIN documents d 
    ON d.document_id = th.document_id AND d.document_id = ?

    INNER JOIN users u ON u.user_id = th.received_by 

    INNER JOIN departments dc ON dc.department_id = th.transfer_department_id 
    ORDER BY date_received DESC`

    db.query(q, id, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json({ data, docu_name, id })
    })
})

app.get("/get-roles", (req, res) => {
    const q = "SELECT * from roles;"

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-departments", (req, res) => {
    const q = "SELECT * from departments WHERE status != 'D';"

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.post("/check-new-credentials", (req, res) => {
    // CHECK IF CREDENTIALS ARE VALID
    const chk = [
        req.body.email,
        req.body.username
    ]

    console.log(chk)

    var q = "SELECT SUM(CASE WHEN u.email = ? THEN 1 ELSE 0 END) AS email, SUM(CASE WHEN u.username = ? THEN 1 ELSE 0 END) AS username FROM `users` u WHERE u.email = ? OR u.username = ?; "

    db.query(q, [...chk, ...chk], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        console.log(data)
        return res.json(data)
    })
})

app.post("/add-user", async (req, res) => {
    const uid = req.body.uid

    const val = [
        req.body.n_username,
        req.body.n_email,
        req.body.n_password,
        req.body.n_first,
        req.body.n_middle,
        req.body.n_last,
        req.body.n_role_id,
        req.body.n_dept_id,
    ]

    const msg = 'Administrator [' + req.body.uname + '] created an account for [' + val[0] + '].'

    var q = "INSERT INTO users (username, email, password, name_given, name_middle_initial, name_last, role, department_id) VALUES (?);"

    db.query(q, [val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Add New User', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.put("/deactivate", (req, res) => {
    const uid = req.body.uid

    const id = req.body.id

    const msg = 'Administrator [' + req.body.uname + '] deactivated user [' + req.body.username + ']\'s account.'

    var q = "UPDATE users SET account_status = 'D' WHERE user_id = ?"

    db.query(q, [id], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Deactivate User', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.put("/reactivate", (req, res) => {
    const uid = req.body.uid

    const id = req.body.id

    const msg = 'Administrator [' + req.body.uname + '] re-activated user [' + req.body.username + ']\'s account.'

    var q = "UPDATE users SET account_status = 'A' WHERE user_id = ?"

    db.query(q, [id], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Re-activate User', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.post("/add-department", (req, res) => {
    const uid = req.body.uid

    const val = [
        req.body.n_dept_name,
        req.body.n_dept_contact,
        req.body.n_dept_location,
    ]

    const msg = 'Administrator [' + req.body.uname + '] created the department [' + val[0] + '].'

    var q = "INSERT INTO departments (name, contact, location) VALUES (?);"

    db.query(q, [val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Add New Department', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.put("/edit-department", (req, res) => {
    const uid = req.body.uid

    const val = [
        req.body.e_dept_name,
        req.body.e_dept_contact,
        req.body.e_dept_location,
        req.body.s_dept_name,
    ]

    const msg = 'Administrator [' + req.body.uname + '] changed the department [' + val[1] + ']\'s name to [' + val[0] + '].'

    var q = "UPDATE departments SET name = ?, contact  = ?, location = ? WHERE name = ?;"

    db.query(q, [...val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Edit Department', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.put("/delete-department", (req, res) => {
    const uid = req.body.uid

    const val = [
        req.body.s_dept_name,
    ]

    const msg = 'Administrator [' + req.body.uname + '] deleted the department [' + req.body.username + '].'

    var q = "UPDATE departments SET status = 'D' WHERE name = ?;"

    db.query(q, [...val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Delete Department', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-users", (req, res) => {
    const q = "SELECT u.*, r.name as 'role_name', d.name as 'department_name' FROM users u INNER JOIN roles r ON r.role_id = u.role INNER JOIN departments d ON d.department_id = u.department_id;"

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.put("/update-user", (req, res) => {
    const uid = req.body.uid

    const val = [
        req.body.e_username,
        req.body.e_email,
        req.body.e_password,
        req.body.e_first,
        req.body.e_middle,
        req.body.e_last,
        req.body.e_role_id,
        req.body.e_dept_id,
        req.body.e_id
    ]

    const msg = 'Administrator [' + req.body.uname + '] edited user [' + val[0] + ']\'s details.'

    var q = "UPDATE users SET username = ?, email = ?, password = ?, name_given = ?, name_middle_initial = ?, name_last = ?,  role = ?, department_id = ? WHERE user_id = ?"

    db.query(q, [...val], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
    })

    var q = "INSERT INTO activity_logs (user_id, activity, description) VALUES (?, 'Edit User', ?)"

    db.query(q, [uid, msg], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.post("/send-mailsx", (req, res) => {
    let message = {
        from: '"Docutracker" <docutracker.bulsu@gmail.com>',
        to: "aricebelda@gmail.com",
        subject: "Test",
        text: "This is a drill"
    }

    transporter.sendMail(message).then((info) => {
        return res.json({
            msg: "email sent",
            info: info.messageId,
            preview: nodemailer.getTestMessageUrl(info)
        })
    }).catch(err => {
        return res.json(err)
    })
})

app.get("/get-receive-time/:id", (req, res) => {
    const id = req.params.id

    let q = "SELECT d.date_created FROM documents d WHERE d.document_id = ?"

    db.query(q, [id], (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data[0].date_created)
    })
})

app.post("/send-mails", (req, res) => {
    const recipients = req.body.recipients
    const doc = req.body.newDocument
    const date_received = new Date(req.body.date_received)
    // console.log(new Date(date_received.getTime()).toLocaleTimeString())
    // console.log(new Date(date_received.getTime() + +process.env.OFFSET).toLocaleTimeString())
    // console.log(process.env.OFFSET)
    // console.log(+date_received.getTime() + +process.env.OFFSET)

    let config = {
        service: 'gmail',
        auth: {
            user: process.env.M_MAIL,
            pass: process.env.M_PASS
        }
    }

    let transporter = nodemailer.createTransport(config)

    let message = {
        from: process.env.M_MAIL,
        to: recipients,
        subject: doc.title,
        text: `Good day!

BulSU Docutracker would like to keep you up-to-date with the location of the following document:
    \tDocument Title: ` + doc.title + `
    \tCreated by: ` + doc.creator_name + `
    \tDepartment: ` + doc.origin_name + `
    \tDate Received: ` + date_received.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ` ` + new Date(date_received.getTime() + +process.env.OFFSET).toLocaleTimeString() + `
        
You can track the document here:
` + process.env.TRACKING_BASE_URL + `tracking/` + doc.id + `

Thank you!`
    }

    transporter.sendMail(message).then((info) => {
        return res.json({
            msg: "email sent",
            info: info.messageId,
        })
    }).catch(err => {
        console.log("ERROR!")
        return res.json(err)
    })
})

app.get("/get-activity-logs", (req, res) => {
    const q = "SELECT a.*, u.username FROM activity_logs a INNER JOIN users u ON u.user_id = a.user_id"

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-statistics", (req, res) => {
    var q = "SELECT d.department_id, d.name, COUNT(t.transfer_department_id) as 'total_documents', COUNT(DISTINCT t.document_id) as 'unique_documents' FROM departments d LEFT JOIN transfer_history t on d.department_id = t.transfer_department_id GROUP BY d.name"

    var docCounts;

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        docCounts = data
    })

    q = "SELECT t.transfer_id, t.document_id, t.transfer_department_id, t.date_received, LAG(t.date_received, -1) OVER ( PARTITION BY document_id ORDER BY date_received ) date_departed, t.completed FROM `transfer_history` t WHERE completed != 'C' ORDER BY `t`.`transfer_department_id` ASC, `t`.`document_id` ASC, `t`.`transfer_id` ASC;"

    var holdTime;

    db.query(q, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        holdTime = data
        return res.json({ holdTime, docCounts })
    })
})

app.get("/identify-document/:docID", (req, res) => {
    const docID = req.params.docID

    const q = "SELECT COUNT(document_id) as 'result' FROM documents WHERE document_id = ?"

    db.query(q, docID, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

app.get("/get-latest-location/:docID", (req, res) => {
    const docID = req.params.docID

    const q = "SELECT * FROM transfer_history t WHERE t.document_id = ? ORDER BY t.date_received DESC LIMIT 1"

    db.query(q, docID, (err, data) => {
        res.set('Access-Control-Allow-Origin', '*')
        if (err) return res.json(err);
        return res.json(data)
    })
})

// app.get("/*", function (req, res) {
//     res.sendFile(path.join(__dirname, "dist/index.html"), function (err) {
//         if (err) {
//             res.status(500).send(err);
//         }
//     });
// });

const port = process.env.PORT || 8900;

app.listen(port, "0.0.0.0", () => {
    console.log("Connected to database, port: " + port);
})