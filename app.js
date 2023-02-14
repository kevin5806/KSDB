const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv'); dotenv.config();

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
        codeID: { type: String},
        ban: { type: Boolean }

    })
)

const Invitecode = mongoose.model('invitecode',
    new mongoose.Schema({

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
app.get('/dashboard/:code', async (req, res) => {

    if (req.session.auth === true) { //verifica l'autenticazione
  
        const data = await Data.find({userID: req.session.userID}).exec();
        const log = await LOG.find({userID: req.session.userID}).exec();
  
        //error = 1 > campi di input vuoti
        //error = 2 > imput inserito nel edit non valido
        res.render('dashboard', {array: data, log: log, error: req.query.error, errorID: req.query.id});
  
    } else { //se non autenticato
  
        res.redirect('/login');
  
    }
})

app.get('/code', (req, res) => {
    
    new Invitecode ({

        creatorID: "Test",
        valid: true

    }).save((err) => {
        if (err) return res.status(500).send({ error: err });

        res.redirect("/register");
    })

})

app.get('/register', (req, res) => {
    
    //error = 1 > Input inserito non valido
    //error = 2 > Codice di invito non presente sul database
    //error = 3 > Codice di invito già usato
    //error = 4> User gia in uso
    res.render('register', {error: req.query.error});

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
        Invitecode.findOne({ _id: code }, (err, codeData) => {
            
            // Se il codice di invito non esiste passa un errore
            if (!(codeData)) return res.redirect('/register?error=2');
            
            //verifica degli errori !!(non spostare sopra al erorre precedente e causa un conflitto)!!
            if (err) return res.status(500).send({ error: err });

            // Se "valid" è falso passa un errore
            if (!(codeData.valid)) return res.redirect('/register?error=3');

            
            // Verifica della presenza del user sul database
            User.findOne({ user: user }, (err, userData) => {
                if (err) return res.status(500).send({ error: err2 });
            
                if (userData) return res.redirect('/register?error=4');
              
                // Salvataggio dei dati sul database
                new User ({

                    codeID: codeData._id,
                    name: name,
                    surname: surname,
                    user: user,
                    password: password,
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


// route di redirect all pagina di login
app.get('/login', (req, res) => {

    //error = 1 > input inserito non valido
    //error = 2 > password/utente errati
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

        User.findOne({ user: user, password: password }, (err, userData) => {
            if (err) return res.status(500).send({ error: err });
            
            //se non viene trovato nessun documento reinderizza con errore (utente o password errati)
            if (!userData) return res.redirect('/login?error=2');

            //atentica l'utente e quindi verifica la sessione
            req.session.auth = true;

            //salva l'id del utente nella sessione
            req.session.userID = userData._id;
            
            new LOG({

                userID: userData._id,
                client: req.headers['user-agent'],
                date: new Date(),
                ip: req.ip
            
            }).save((err) => {
                if (err) return res.status(500).send({ error: err });

                //reinderizzamento alla pagina principale dove avverrà nuovamente il controllo sul autenticazione
                res.redirect('/dashboard');
            })

        })
    }
})

app.get('/logout', (req, res) => {

    req.session.auth = false;

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
        //se l'user non è autenticato
        
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

                Data.findOneAndRemove({ _id: id }, (err) => {
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
    
    } else { //se non autenticato

        res.redirect('/login');

    }
})

//avvio del server
app.listen(PORT, () => {
    console.log(`server sulla porta ${PORT}`);
})