const { client } = require('websocket');
const _ = require('lodash/array');

const getBorrowEvents = (events) => {
    const borrowEvents = events.filter((event) => {
        return event.attributes.some((a) => a.key === 'action' && a.value === 'borrow_stable')
    });
    return borrowEvents;
}

const getContractEvents = (logs) => {
    if(Array.isArray(logs)) {
        // Filter execute_contract events
        const filteredEvents = logs
            .filter((logMsg) => logMsg.events.some((e) => e.type === 'execute_contract'))
            .map((logMsg) => logMsg.events)
            .map((events) => getBorrowEvents(events));
        const borrowEvents = _.flatten(filteredEvents);
        return borrowEvents;
    } 
    return [];
}

const processData = (message) => {
    const blockMessage = JSON.parse(message.utf8Data);
    const blockData = blockMessage.data;
    // Checking on block transactions
    blockData.txs.forEach((tx) => {
        const txhash = tx.txhash;
        const contractEvents = getContractEvents(tx.logs);
        let attributes = {}
        if(contractEvents.length > 0) {
            const attributesArr = contractEvents[0].attributes;
            attributesArr.forEach((a) => {
                attributes[a.key] = a.value;
            });
        }
        console.log(txhash);
        console.log(attributes);
    })
}

const connectTerraService = () => {
    const socketClient = new client();

    socketClient.on('connectFailed', function(error) {
        console.error('Socket connect failed. Reconnect will be attempted in 1 second.', error.toString());
        setTimeout(function() {
            connectTerraService();
        }, 1000);
    });

    socketClient.on('connect', function(connection) {
        connection.on('error', function(error) {
            console.error('Socket encountered error: ', error.toString(), ' closing socket...');
            connection.close();
        });
        connection.on('close', function() {
            console.log('Socket is closed. Reconnect will be attempted in 1 second.', error.toString());
            setTimeout(function() {
                connectTerraService();
            }, 1000);
        });
        connection.on('message', function(message) {
            processData(message);
        });
        console.log('connected to websocket. subscribing...')
        connection.send(JSON.stringify({subscribe: "new_block", chain_id: "columbus-4"}));
    });

    socketClient.connect('wss://observer.terra.dev')
}

// Start Terra Service connection
connectTerraService();
