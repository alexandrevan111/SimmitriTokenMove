module.exports = function(app) {
	var Web3 = require('web3')
		bcrypt = require('bcrypt'),
		Cryptr = require('cryptr'),
		BigNumber = require('bignumber.js'),
		net = require('net'),
		Tx = require('ethereumjs-tx'),
		stripHexPrefix = require('strip-hex-prefix'),
		ethereum_address = require('ethereum-address'),
		svWriter = require('csv-write-stream');

	var cryptr = new Cryptr('SimmitriBlockchain');
	var client = new net.Socket();

	/* Web3 Initialization */
	//var web3 = new Web3(new Web3.providers.IpcProvider(app.web3.provider, client));
	var web3 = new Web3(new Web3.providers.HttpProvider(app.web3.provider)); // Using Infura

	/* Contract initialization */
	var contractObj = new web3.eth.Contract(app.contract.abi, app.contract.address);
	contractObj.options.from = app.contract.owner_address;

	var nonceGlobal = 0;
	
	app.get('/test', function(req, res){
		return res.send({status: true, msg: 'this is a test!', data: nonceGlobal});
	});

	/* Send ETH */
	app.post('/send', async function(req, res){
		if(!hasRights(req))
			return res.send({status: false, msg: 'you are not authorized!'});

		if(!req.body.address)
			return res.send({status: false, msg: 'invalid parameters!'});

		var address = req.body.address;

		var privateKeyString = stripHexPrefix(app.dist.privateKey);
		var privateKey = new Buffer(privateKeyString, 'hex');

		var gasPrice = new BigNumber(await web3.eth.getGasPrice());
		var gasPriceGlobal = new BigNumber(20000000000);

		var ethAmount = new BigNumber(4000000000000000);

		if(gasPrice.isLessThan(gasPriceGlobal))
			gasPrice = gasPriceGlobal;

		var nonce = await web3.eth.getTransactionCount(app.dist.address).catch((error) => {
			return res.send({status: false, msg: 'error occurred in getting transaction count!'});
		});

		if(nonceGlobal != 0 && nonceGlobal >= nonce)
			nonce = nonceGlobal + 1;

		nonceGlobal = nonce;

		/* Sending ETH */
		var txETHParams = {
			nonce: web3.utils.toHex(nonce),
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex(400000),
			from: app.dist.address,
			to: address,
			value: web3.utils.toHex(ethAmount),
			chainId: app.chainId,
		};

		var txETH = new Tx(txETHParams);
		txETH.sign(privateKey);

		var serializedTxETH = txETH.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTxETH.toString('hex'))
		.on('transactionHash', function(hash){
			console.log('hash - ' + hash);
			return res.send({status: true, hash: hash});
		}).on('error', function(err){
			console.log(err.message);
			return res.send({status: false, msg: err.message});
		}).on('receipt', function(res){
			console.log(res);
		});
		/* Sending ETH End */
	});
	/* Transfer */
	app.post('/transfer', async function(req, res){
		if(!hasRights(req))
			return res.send({status: false, msg: 'you are not authorized!'});

		if(!req.body.address || !req.body.tokenAmount || isNaN(req.body.tokenAmount))
			return res.send({status: false, msg: 'invalid parameters!'});

		var address = req.body.address;
		var tokenAmount = new BigNumber(req.body.tokenAmount * Math.pow(10, app.contract.decimals));

		var privateKeyString = stripHexPrefix(app.dist.privateKey);
		var privateKey = new Buffer(privateKeyString, 'hex');

		var gasPrice = new BigNumber(await web3.eth.getGasPrice());
		var gasPriceGlobal = new BigNumber(20000000000);

		if(gasPrice.isLessThan(gasPriceGlobal))
			gasPrice = gasPriceGlobal;

		var nonce = await web3.eth.getTransactionCount(app.dist.address).catch((error) => {
			return res.send({status: false, msg: 'error occurred in getting transaction count!'});
		});

		if(nonceGlobal != 0 && nonceGlobal >= nonce)
			nonce = nonceGlobal + 1;

		nonceGlobal = nonce;

		var txData = contractObj.methods.transfer(address, tokenAmount).encodeABI();
		var txParams = {
			nonce: web3.utils.toHex(nonce),
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex(400000),
			from: app.dist.address,
			to: contractObj._address,
			value: '0x00',
			chainId: app.chainId,
			data: txData
		};

		var tx = new Tx(txParams);
		tx.sign(privateKey);

		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('transactionHash', function(hash){
			console.log('hash - ' + hash);
			return res.send({status: true, hash: hash});
		}).on('error', function(err){
			console.log(err.message);
			return res.send({status: false, msg: err.message});
		}).on('receipt', function(res){
			console.log(res);
		});
	});
	/* Transfer Bridge */
	app.post('/transferBridge', async function(req, res){
		if(!hasRights(req))
			return res.send({status: false, msg: 'you are not authorized!'});

		if(!req.body.fromAddress || !req.body.toAddress || !req.body.private || !req.body.tokenAmount)
			return res.send({status: false, msg: 'invalid parameters!'});

		var fromAddress = req.body.fromAddress;
		var toAddress = req.body.toAddress;
		var tokenAmount = new BigNumber(req.body.tokenAmount * Math.pow(10, app.contract.decimals));
		var private = req.body.private;
			
		var privateKeyString = stripHexPrefix(private);
		var privateKey = new Buffer(privateKeyString, 'hex');

		var gasPrice = new BigNumber(await web3.eth.getGasPrice());
		var gasPriceGlobal = new BigNumber(20000000000);

		if(gasPrice.isLessThan(gasPriceGlobal))
			gasPrice = gasPriceGlobal;

		var nonce = await web3.eth.getTransactionCount(fromAddress).catch((error) => {
			return res.send({status: false, msg: 'error occurred in getting transaction count!'});
		});

		var txData = contractObj.methods.transfer(toAddress, tokenAmount).encodeABI();
		var txParams = {
			nonce: web3.utils.toHex(nonce),
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex(400000),
			from: fromAddress,
			to: contractObj._address,
			value: '0x00',
			chainId: app.chainId,
			data: txData
		};

		var tx = new Tx(txParams);
		tx.sign(privateKey);

		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('transactionHash', function(hash){
			console.log('hash - ' + hash);
			return res.send({status: true, hash: hash});
		}).on('error', function(err){
			console.log(err.message);
			return res.send({status: false, msg: err.message});
		}).on('receipt', function(res){
			console.log(res);
		});
	});
	/* Transfer */
	app.post('/transferBack', async function(req, res){
		if(!hasRights(req))
			return res.send({status: false, msg: 'you are not authorized!'});

		if(!req.body.address || !req.body.private || !req.body.tokenAmount || isNaN(req.body.tokenAmount))
			return res.send({status: false, msg: 'invalid parameters!'});

		var address = req.body.address;
		var private = req.body.private;
		var tokenAmount = new BigNumber(req.body.tokenAmount * Math.pow(10, app.contract.decimals));

		var privateKeyString = stripHexPrefix(private);
		var privateKey = new Buffer(privateKeyString, 'hex');

		var gasPrice = new BigNumber(await web3.eth.getGasPrice());
		var gasPriceGlobal = new BigNumber(20000000000);

		if(gasPrice.isLessThan(gasPriceGlobal))
			gasPrice = gasPriceGlobal;

		var nonce = await web3.eth.getTransactionCount(address).catch((error) => {
			return res.send({status: false, msg: 'error occurred in getting transaction count!'});
		});

		var txData = contractObj.methods.transfer(app.dist.address, tokenAmount).encodeABI();
		var txParams = {
			nonce: web3.utils.toHex(nonce),
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex(400000),
			from: address,
			to: contractObj._address,
			value: '0x00',
			chainId: app.chainId,
			data: txData
		};

		var tx = new Tx(txParams);
		tx.sign(privateKey);

		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('transactionHash', function(hash){
			console.log('hash - ' + hash);
			return res.send({status: true, hash: hash});
		}).on('error', function(err){
			console.log(err.message);
			return res.send({status: false, msg: err.message});
		}).on('receipt', function(res){
			console.log(res);
		});
	});

	function hasRights(req){
		var key = '';
		if(req.headers['x-api-key'])
			key = req.headers['x-api-key'];

		if(key != app.key)
			return false;
		return true;
	}
}