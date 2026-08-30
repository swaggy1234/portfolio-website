const database = require('./firebase.js')
function save(log, globalLoss, username)
{
    const obj = {
        log : log,
        globalLoss: globalLoss
    }
    try {
        // set() validates its payload synchronously, so an invalid log would throw
        // past the promise catch and abort whatever UI action triggered the log.
        database.db.collection("prov_"+username).doc(""+Date.now()).set(obj)
                                            .then(ev=>console.log("success"))
                                            .catch(err=>globalLoss++)
    } catch (err) {
        console.warn("[Provenance] online log skipped:", err && err.message ? err.message : err)
    }
}

module.exports = {
    save: save
}