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
const mongoURL = process.env.DB_URL || 'mongodb+srv://kevinserv:Rva2WSTmFeI6NUXa@kevincluster.svejfwa.mongodb.net/ksdb';

//chiave di criptazione per la generazione sessioni
const sessionKEY = process.env.SESSION_KEY || 'EsHnsaShdsS44225KbPeSsdhVmYq';

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
mongoose.connect( mongoURL, {
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
        valid: { type: Boolean },
        creationDate: { type: String }

    })
)

// ################ Sessioni ######################

//funzione usata per creare una sessione
app.use(session({
    store: MongoStore.create({
        mongoUrl: mongoURL,

        touchAfter: 24 * 3600 *1, // indica il tempo massimo senza un utilizzo della sessione (in s)
        autoRemove: 'native', // rimuovi automaticamente le sessioni scadute dal database
        mongoOptions: { useNewUrlParser: true } // opzioni per la connessione a MongoDB
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

// ################# Appunti ######################
/*

    // in caso servissero anche i dati del utente

        //verifica del ban
        const userData = await User.findById(sessionUID);
            
        //se l'utente è bannato viene reindirizzato al logout
        if (userData.ban) return res.redirect('/logout');

    // in caso si dovesse verificare solo il ban

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: sessionUID, ban: true}) ) return res.redirect('/logout');


*/
// ################## Route #######################

app.get('/', (req, res) => {

    res.sendFile(__static + '/index.html');

})


//ottimizzata
app.get('/dashboard', async (req, res) => {
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');
        
        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: sessionUID, ban: true}) ) return res.redirect('/logout');

        // Lettura dati dal database
        const data = await Data.find({userID: sessionUID}).exec();        
            
        // RENDERIZZAZIONE CON DATI
        //error = 1 > campi di input vuoti
        //error = 2 > input inserito nel edit non valido
        //error = 3 > input inserito nel delete account sbagliato

        res.render('dashboard', {
            data: data,
            /* inviteCC: inviteCC, */
            InviteCode: req.query.InviteCode, 
            url: `${req.protocol}://${req.get('host')}`, 
            error: req.query.error, 
            errorID: req.query.id
        })

    } catch (err) {

        if (err) return res.status(500).send({err});

    }
})


app.get('/settings', async (req, res) => {
    try {
        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;
            
        //verifica del ban e salvataggio dati utente
        const userData = await User.findById(sessionUID);
    
        //se l'utente è bannato viene reindirizzato al logout
        if (userData.ban) return res.redirect('/logout');

        // Download dati dal database

        //log di accesso del utente
        const logData = await LOG.find({userID: sessionUID}).exec();
        //inviti creati dal utente
        const inviteData = await Invitecode.find({creatorID: sessionUID}).exec();

        // error 1 > 
        res.render('settings', {error: req.query.error ,logData: logData, inviteData: inviteData});

    } catch (err) {

        if (err) return res.status(500).send({err});

    }
})


app.get('/login', (req, res) => {

    //error = 1 > input inserito non valido
    //error = 2 > password/utente errati
    //error = 3 > user bannato
    //error = 4 > errore in caso si provi ad accedere ad una pagina senza essere loggati (login first)
    res.render('login', {error: req.query.error} );

})


//ottimizzata
app.post('/login', async (req, res) => {
    try {

        // Estrae i dati dalla richiesta
        const user = req.body.user;  
        const password = req.body.password;

        // Verifica degli input inseriti
        if (
            
            !user || !password
            || typeof user !== "string"
            || typeof password !== "string"

        ) return res.redirect('/login?error=1');
        
        // Cerca l'user sul databse
        const userData = await User.findOne({ user: user });
        
        // Se il nome utente inserito non esiste restituisce un errore
        if (!userData) return res.redirect('/login?error=2');
        
        // Controllo password inserita e password del account
        const result = await bcrypt.compare(password, userData.password); //non togliere mai await

        // Se le password non cobaciano restituisce un errore
        if (!result) return res.redirect('/login?error=2');
        
        // Se l'utente è bannato restituisce un errore
        if (userData.ban) return res.redirect('/login?error=3');
        
        // Creazione della sessione con i relativi dati
        req.session.auth = true;
        req.session.userID = userData._id;
        
        // Salvataggio dei LOG riguardo il login
        await new LOG({
            userID: userData._id,
            client: req.headers['user-agent'],
            date: new Date(),
            ip: req.headers['x-client-ip']
        }).save();

        // Reinderizzamento all Dashboard
        res.redirect('/dashboard');

    } catch (err) {

        res.status(500).send({err});

    }
})


//ottimizzata
app.get('/logout', async (req, res) => {
    try {

        // Distrugge la ssessione
        await req.session.destroy();

        // Reinderizza al login
        res.redirect('/login');

    } catch (err) {

        res.status(500).send({err});

    }
})


app.get('/generate/invite', async (req, res) => {
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: sessionUID, ban: true}) ) return res.redirect('/logout');

        const code = uuid.v4();

        // Salva sul database il nuovo invito
        await new Invitecode ({

            code: code,
            creatorID: sessionUID,
            valid: true,
            creationDate: new Date()

        }).save();

        // Reindirizza passando il nuovo codice
        res.redirect(`/dashboard?InviteCode=${code}`);

    } catch (err) {

        res.status(500).send({err});

    }
})


app.get('/register', (req, res) => {
    
    //error = 1 > Input inserito non valido
    //error = 2 > Codice di invito non presente sul database
    //error = 3 > Codice di invito già usato
    //error = 4> User gia in uso
    res.render('register', {error: req.query.error, InviteCode: req.query.InviteCode});

})


//ottimizzata
app.post('/register', async (req, res) => {
    try {

        // Estrae i dati dalla richiesta
        const user = req.body.user; 
        const password = req.body.password; 
        const name = req.body.name; 
        const surname = req.body.surname; 
        const code = req.body.code;
       
        // Verifica della validità degli input
        if (!code || !user || !password || !name || !surname

            || typeof code !== "string"
            || typeof user !== "string"
            || typeof password !== "string"
            || typeof name !== "string"
            || typeof surname !== "string"

        ) return res.redirect('/register?error=1');

        
        // Verifica che il codice esista e che non sia già stato usato
        const codeData = await Invitecode.findOne({ code: code });

        // Se il codice di invito non esiste restituisce un errore
        if (!codeData) return res.redirect('/register?error=2');
        
        // Se "valid" è falso restituisce un errore
        if (!codeData.valid) return res.redirect('/register?error=3');
        
        // Verifica della presenza del user sul database
        const userData = await User.findOne({ user: user });

        // Se l'user esiste già restituisce un errore
        if (userData) return res.redirect('/register?error=4');

        // Hashing della password
        const hashPw = await bcrypt.hash(password, 5);

        // Savataggio del user sul database
        await new User({
            inviteCodeID: codeData._id,
            name: name,
            surname: surname,
            user: user,
            password: hashPw,
            ban: false
        }).save();
        
        // Se la registrazione è stata salvata correttamente, salva l'invito come usato
        codeData.valid = false;
        await codeData.save();
        
        // Ritorno al login
        res.redirect('/login');

    } catch (err) {

        res.status(500).send({err});

    }
})


//ottimizzata
app.post('/delete/account', async (req, res) => {
    try {
        
        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //verifica del ban
        const userData = await User.findById(sessionUID);
        
        //se l'utente è bannato viene reindirizzato al logout
        if (userData.ban) return res.redirect('/logout');

        // Estrae i dati dalla richiesta
        const password = req.body.password;
        
        // Verifica l'input inserito
        if (typeof password !== "string") return res.redirect('/settings?error=3');

        // Controllo password inserita e password del account
        const result = await bcrypt.compare(password, userData.password) //non togliere mai await

        // Se le password non cobaciano restituisce un errore
        if (!result) return res.redirect('/settings?error=3');

        // Elimina i dati dell'account in parallelo
        await Promise.all([
            Data.deleteMany({ userID: sessionUID }),
            LOG.deleteMany({ userID: sessionUID }),
            Invitecode.deleteMany({ $or: [{ creatorID: sessionUID, valid: true }, { _id: userData.inviteCodeID }] }),
            User.findByIdAndRemove(sessionUID)
        ])

        // Reindirizza al logout
        res.redirect('/logout');

    } catch (err) {

        res.status(500).send({err});

    }
})

app.get('/delete/log', async (req, res) => {
    
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: req.session.userID, ban: true}) ) return res.redirect('/logout');

        //eliminazione log
        await LOG.deleteMany({ userID: sessionUID });

        res.redirect('/settings');

    } catch (err) {

        res.status(500).send({err});

    }

})

app.post('/delete/invite', async (req, res) => {
    
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: req.session.userID, ban: true}) ) return res.redirect('/logout');

        //eliminazione log
        await Invitecode.findOneAndRemove({ _id: req.body.id, creatorID: sessionUID, valid: true });

        res.redirect('/settings');

    } catch (err) {

        res.status(500).send({err});

    }

})

//ottimizzata
app.post('/data', async (req, res) => {
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: sessionUID, ban: true}) ) return res.redirect('/logout');

        // Estrae i dati dalla richiesta
        let sum = Number(req.body.sum);
        const name = req.body.name;
        const sign = Number(req.body.sign);

        // Verifica la validità dei dati inseriti
        if (

            isNaN(sum) ||
            typeof name !== 'string' ||
            name === '' ||
            (sign !== 1 && sign !== 2)

        ) return res.redirect('/dashboard?error=1');

        // Esegue le operazioni del menù di selezione positivo/negativo
        if (sign === 1) {

            // Negativo
            sum = Math.abs(sum);
            sum = sum * -1;

        } else {

            // Positivo
            sum = Math.abs(sum);  

        }

        // Salva i nuovi dati sul database
        await new Data({

            userID: sessionUID,
            sum: sum,
            name: name

        }).save();

        // Reindirizza alla pagina principale
        res.redirect('/dashboard');

    } catch (err) {

        res.status(500).send({err});

    }
})

//ottimizzata
app.post('/dataedit', async (req, res) => {
    try {

        // Verifica l'autenticazione
        if (!req.session.auth) return res.redirect('/login?error=4');

        const sessionUID = req.session.userID;

        //se l'utente è bannato viene reindirizzato al logout
        if (await User.findOne({_id: sessionUID, ban: true}) ) return res.redirect('/logout');

        // Estrae i dati dalla richiesta
        const id = req.body.id;
        let sum = Number(req.body.sum);
        const operation = Number(req.body.operation);
        const sBtn = Number(req.body.sBtn);
        const sign = Number(req.body.sign);

        // Verifica la validità dei dati inseriti
        if (

            id === '' 
            || typeof id !== 'string' 
            || isNaN(sum) 
            || (sum === '' && operation !== 2 && sBtn !== 2) 
            || !(operation === 1 || operation === 2) 
            || !(sBtn === 1 || sBtn === 2) 
            || !(sign === 1 || sign === 2)

        ) return res.redirect(`/dashboard?error=2&id=${id}`);
        
        const data = await Data.findOne({userID: sessionUID, _id: id });

        if (sBtn == 1) {
            // inviato con il pulsante normale
            
            if (sign === 1) {

                // Negativo
                sum = Math.abs(sum);
                sum = sum * -1;

            } else {

                // Positivo
                sum = Math.abs(sum);  

            }

            if (operation === 1) {

                // Operazione ADD
                data.sum += sum;

            } else {

                // Operazione SET
                data.sum = sum;

            }
            
            // Salva il documento modificato
            await data.save();

        } else if (sBtn == 2) {
            // inviato con il pulsante delete

            // Elimina il dato dal database
            await data.remove();

        }

        // Ritorna alla dashboard
        res.redirect('/dashboard');

    } catch (err) {

        res.status(500).send({err});

    }
})

// ############## Avvio Server ####################

//avvio del server
app.listen(PORT, () => {
    console.log(`server aperto sulla porta ${PORT}`);
})

// ################################################