const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const uuid = require('uuid');
const dotenv = require('dotenv'); dotenv.config();
const helmet = require('helmet');
const bcrypt = require('bcrypt');

//COSTANTI APP

//creazione dell app
const app = express();

//parametri del server
const PORT = process.env.PORT || 3000;

//url del database
const mongoURL = process.env.DB_URL;

//chiave di criptazione per la generazione sessioni
const sessionKEY = process.env.SESSION_KEY;

// ######### Impostazioni AppExpress ##############

//imposto la cartella e la engine di render
app.set('view engine', 'ejs');

// utilizzo delle librerie express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//per la sicurezza e la protezzione da vari tipi di attachi del app
app.use(helmet());

//serve per servire file statici accessibili da tutte le pagina del sito
const __static =  __dirname + '/public'; 

app.use(express.static(__static));

// ##################### Database ###########################

//rimuove un errore di mongoose nella versione attuale
mongoose.set('strictQuery', true);

// Connessione al database
mongoose.connect( mongoURL , {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// MODELLI

const LOG = mongoose.model('log',
    new mongoose.Schema({

        userID: { type: String },
        client: { type: String },
        date: { type: String },
        ip: { type: String }

    })
)

const Data = mongoose.model('data',
    new mongoose.Schema({

        userID: { type: String },
        name: { type: String },
        sum: { type: Number }

    })
)

const User = mongoose.model('user',
    new mongoose.Schema({

        user: { type: String},
        password: { type: String},
        name: { type: String},
        surname: { type: String},
        inviteCodeID: { type: String},
        ban: { type: Boolean }

    })
)

const Invitecode = mongoose.model('invitecode',
    new mongoose.Schema({

        code: { type: String },
        creatorID: { type: String },
        valid: { type: Boolean }       

    })
)

// ################ Sessioni ######################

//funzione usata per creare una sessione
app.use(session({
    store: MongoStore.create({
        mongoUrl: mongoURL,

        // indica il tempo massimo senza un utilizzo della sessione (in s)
        touchAfter: 24 * 3600 *1 
    }),
    
    //chiave di criptazione per le sessioni
    secret: sessionKEY, 
    
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 3, // indica la durata massima di un login (in ms)
        httpOnly: true
    }
}))

// ################################################


app.get('/', (req, res) => {

    res.sendFile(__static + '/index.html');

})

// route root di reindirizzamento all pagin principale
app.get('/dashboard', (req, res) => {

    //verifica l'autenticazione del utente
    if (req.session.auth === true) { 
        
        //verifica del ban
        User.findById(req.session.userID, async (err, userData) => {
            if (err) return res.status(500).send({ error: err });

            //se l'utente è bannato viene reindirizzato al logout
            if (userData.ban) return res.redirect('/logout');  

            //se l'utente non è bannato l'eseguzione del programma continua
            const data = await Data.find({userID: req.session.userID}).exec();
            const log = await LOG.find({userID: req.session.userID}).exec();
            
            // RENDERIZZAZIONE CON DATI

            //error = 1 > campi di input vuoti
            //error = 2 > input inserito nel edit non valido
            //error = 3 > input inserito nel delete account sbagliato

            res.render('dashboard', {
                array: data, 
                log: log, 
                InviteCode: req.query.InviteCode, 
                url: `${req.protocol}://${req.get('host')}`, 
                error: req.query.error, 
                errorID: req.query.id
            })
        })

    } else { 

        //se non autenticato
        res.redirect('/login');
  
    }
    
})

app.get('/invite/generate', (req, res) => {
    
    //verifica l'autenticazione
    if (req.session.auth === true) {

        let code = uuid.v4();

        new Invitecode ({

            code: code,
            creatorID: req.session.userID,
            valid: true

        }).save((err) => {
            if (err) return res.status(500).send({ error: err });
            
            res.redirect(`/dashboard?InviteCode=${code}`);
        })

    } else {
        
        //se non autenticato
        res.redirect('/login');

    }
})

app.get('/register', (req, res) => {
    
    //error = 1 > Input inserito non valido
    //error = 2 > Codice di invito non presente sul database
    //error = 3 > Codice di invito già usato
    //error = 4> User gia in uso
    res.render('register', {error: req.query.error, InviteCode: req.query.InviteCode});

})

app.post('/register', (req, res) => {

    let user = req.body.user, 
        password = req.body.password, 
        name = req.body.name, 
        surname = req.body.surname, 
        code = req.body.code;
       
    // Verifica della validità degli input
    if (!code || !user || !password || !name || !surname
        || typeof code !== "string"
        || typeof user !== "string"
        || typeof password !== "string"
        || typeof name !== "string"
        || typeof surname !== "string"
    ) {

        return res.redirect('/register?error=1');

    } else { 
        
        // Verifica che il codice esista e che non sia già stato usato
        Invitecode.findOne({ code: code }, (err, codeData) => {
            
            // Se il codice di invito non esiste passa un errore
            if (!(codeData)) return res.redirect('/register?error=2');
            
            //verifica degli errori !!(non spostare sopra al erorre precedente e causa un conflitto)!!
            if (err) return res.status(500).send({ error: err });

            // Se "valid" è falso passa un errore
            if (!(codeData.valid)) return res.redirect('/register?error=3');

            
            // Verifica della presenza del user sul database
            User.findOne({ user: user }, async (err, userData) => {
                if (err) return res.status(500).send({ error: err2 });
            
                if (userData) return res.redirect('/register?error=4');

                // Salvataggio dei dati sul database
                new User ({

                    inviteCodeID: codeData._id,
                    name: name,
                    surname: surname,
                    user: user,
                    password: await bcrypt.hash(password, 5),
                    ban: false

                }).save((err) => {
                    if (err) return res.status(500).send({ error: err });

                    // Se la registrazione è stata salvata correttamente, salva l'invito come usato
                    codeData.valid = false;

                    // Salva il documento modificato
                    codeData.save((err) => { 
                        if (err) return res.status(500).send({ error: err });

                        // Ritorno al login
                        res.redirect('/login');
                    })
                })
            })
        })
    }
})

app.post('/account/delete', (req, res) => {

    let password = req.body.password,
        sessionID = req.session.userID;
    
    //se l'utente non è autenticato reindirizza al login
    if (req.session.auth !== true) return res.redirect('/login');

    //input inserito non valido
    if (!password || typeof password !== "string") return res.redirect('/dashboard?error=3'); //da finire

    //account password metch
    User.findById(sessionID, (err, userData) => {
        if (err) return res.status(500).send({ error: err });

        bcrypt.compare(password, userData.password, (err, result) => {
            /* if (err) return res.status(500).send({ error: err }); */

            //se le password non combaciano reinderizza con errore
            if (!(result)) return res.redirect('/dashboard?error=3'); /* da finire */

            //DELETE

            //account data
            Data.deleteMany({userID: sessionID}, (err) => {
                /* if (err) return res.status(500).send({ error: err }); */

            //account log
            LOG.deleteMany({userID: sessionID}, (err) => {
                /* if (err) return res.status(500).send({ error: err }); */

            //inviti non ancora usati creati da questo account e l'invito con il quale si è registrato
            Invitecode.deleteMany({$or: [ { creatorID: sessionID, valid: true }, { _id: userData.inviteCodeID } ] }, (err) => {
                /* if (err) return res.status(500).send({ error: err }); */
            
            //account user
            User.findByIdAndRemove(sessionID, (err) => {
                /* if (err) return res.status(500).send({ error: err }); */

                //se tutto è andato a buon fine reinderizza al logout
                res.redirect('/logout');

            }); }); }); });

        })
    })
})

// route di redirect all pagina di login
app.get('/login', (req, res) => {

    //error = 1 > input inserito non valido
    //error = 2 > password/utente errati
    //error = 3 > user bannato
    res.render('login', {error: req.query.error} );

})

app.post('/login', (req, res) => {

    let user = req.body.user,  
        password = req.body.password;

    if (
        !user || !password
        ||  typeof user !== "string"
        ||  typeof password !== "string"
    ) {

        res.redirect('/login?error=1');

    } else {

        User.findOne({ user: user }, (err, userData) => {
            //se non viene trovato nessun documento reinderizza con errore (utente o password errati)
            if (!userData) return res.redirect('/login?error=2');

            if (err) return res.status(500).send({ error: err });
            
            // compara la password cryptata di quel utente con la password inserita
            bcrypt.compare(password, userData.password, (err, result) => {
                if (err) return res.status(500).send({ error: err });

                //se le password non combaciano reinderizza con errore (utente o password errati)
                if (!(result)) return res.redirect('/login?error=2');
            
                //se l'utente è bannato viene restituito un errore
                if (userData.ban) return res.redirect('/login?error=3');

                //atentica l'utente e quindi verifica la sessione
                req.session.auth = true;

                //salva l'id del utente nella sessione
                req.session.userID = userData._id;
                
                new LOG({

                    userID: userData._id,
                    client: req.headers['user-agent'],
                    date: new Date(),
                    
                    // modificabile dal utente (dati incerti), funziona solo con Azure
                    ip: req.headers['x-client-ip']
                
                }).save((err) => {
                    if (err) return res.status(500).send({ error: err });

                    //reinderizzamento alla pagina principale dove avverrà nuovamente il controllo sul autenticazione
                    res.redirect('/dashboard');
                })
            })

        })
    }
})

app.get('/logout', (req, res) => {

    req.session.destroy((err) => {
        if (err) return res.status(500).send({ error: err });

        res.redirect('/dashboard');
    })

})

// route per l'aggiunta di nuovi dati
app.post('/data', (req, res) => {

    //verifica l'autenticazione
    if (req.session.auth === true) {

        let sum = Number(req.body.sum), 
            name = req.body.name, 
            sign = Number(req.body.sign);

        // controlla se i campi di input sono vuoti o che non sia stata inserita una somma numerica
        if (
                typeof sum == "number" && !isNaN(sum) 
            &&  typeof name == "string" && name != "" 
            &&  (sign == 1 || sign == 2)
        ) {

            //Esegue le operzioni del menù di selezione positivo negativo nel front end
            if (sign == 1) { //sottrai
                    
                //rende il numero negativo
                sum = Math.abs(sum);
                sum = sum * -1;

            } else if (sign == 2) { // somma
                
                //rende il numero positivo
                sum = Math.abs(sum);

            }

            //Salva i nuovi dati sul database
            new Data({

                userID: req.session.userID,
                name: name,
                sum: sum

            }).save((err) => { 
                if (err) return res.status(500).send({ error: err });

                //reindirizzamento alla pagina principale
                res.redirect('/dashboard');
            })

        } else {
            //se i campi di input sono vuoti
            
            //reinderizza passando un errore
            res.redirect('/dashboard?error=1');

        }
        
    } else {

        //se non autenticato
        res.redirect('/login');
        
    }
})


// route per la modifica dei dati gia presenti
app.post('/dataedit', (req, res) => {

    if (req.session.auth === true) { //verifica l'autenticazione

        let id = req.body.id, 
            sum = Number(req.body.sum), 
            operation = Number(req.body.operation), 
            sBtn = Number(req.body.sBtn),
            sign = Number(req.body.sign);

        if (
               ((typeof id === "string" && id != "") 
            && (typeof sum === "number" && !isNaN(sum) && (sum != "" || operation == 2 || sBtn == 2))) 
            && (operation == 1 || operation == 2)
            && (sBtn == 1 || sBtn == 2)
            && (sign == 1 || sign == 2)
        ) {

            if (sBtn == 2) { // form inviato con il pulsante delete

                Data.findOneAndRemove({userID: req.session.userID, _id: id }, (err) => {
                    if (err) return res.status(500).send({ error: err });
                    // deleted

                    //ritorna alla dashboard
                    res.redirect('/dashboard');
                })

            } else if (sBtn == 1) { // form inviato con il pulsante normale
                
                if (sign == 1) { //sottrai
                    
                    //rende il numero negativo
                    sum = Math.abs(sum);
                    sum = sum * -1;

                } else if (sign == 2) { // somma
                    
                    //rende il numero positivo
                    sum = Math.abs(sum);

                }

                Data.findOne({userID: req.session.userID, _id: id }, (err, data) => {
                    if (err) return res.status(500).send({ error: err });

                    // Modifica il valore del documento
                    if (operation === 1) { //add operation

                        data.sum += sum;

                    } else if (operation === 2) { //set operation

                        data.sum = sum;

                    }
                    
                    // Salva il documento modificato
                    data.save((err) => { 
                        if (err) return res.status(500).send({ error: err });

                        //ritorna alla dashboard
                        res.redirect('/dashboard');
                    })
                })
            }  

        } else { //se inserito un input di modifica errato

            res.redirect('/dashboard?error=2&id=' + id);

        }
    
    } else {

        //se non autenticato
        res.redirect('/login');

    }
})

//avvio del server
app.listen(PORT, () => {
    console.log(`server aperto sulla porta ${PORT}`);
})