module.exports = function(app) {
	var {Apis} = require("bitsharesjs-ws");
	var {ChainStore, FetchChain, PrivateKey, TransactionHelper, Aes, TransactionBuilder} = require("bitsharesjs");
	var moment = require('moment');

	/* 10 ** 7 - Asset */
	/* 10 ** 8 - BTC */

	const wifKey = app.config.permission.active.wif;
	const pKey = PrivateKey.fromWif(wifKey);

	const min = 30;
	const max = 300;

	app.get('/getAccount', function(req, res){
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			Apis.instance().db_api().exec('get_full_accounts', [[app.config.account.name], false])
			.then((accounts) => {
				if(Array.isArray(accounts) && Array.isArray(accounts[0]) && accounts[0].length > 0)
					return res.send({status: true, account: accounts[0][1]});
				else
					return res.send({status: false})
			})
			.catch((err) => {
				console.log(err);
				return res.send({status: false});
			});
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});

	app.get('/getAsset', function(req, res){
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			Apis.instance().db_api().exec("lookup_asset_symbols", [[app.config.asset.name]])
			.then((assets) => {
				if(Array.isArray(assets))
					return res.send({status: true, asset: assets});
				else
					return res.send({status: false});
			})
			.catch((err) => {
				console.log(err);
				return res.send({status: false});
			});
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	}); 

	app.get('/getTicker', function(req, res){
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			Apis.instance().db_api().exec("get_ticker", [app.config.btc.name, app.config.asset.name])
			.then((ticker) => {
				return res.send({status: true, ticker: ticker});
			})
			.catch((err) => {
				console.log(err);
				return res.send({status: false});
			});
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});

	app.get('/getOrderBook', function(req, res){
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			Apis.instance().db_api().exec("get_order_book", ['BRIDGE.BTC', app.config.asset.name, 10])
			.then((book) => {
				return res.send({status: true, data: book});
			})
			.catch((err) => {
				console.log(err);
				return res.send({status: false});
			});
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});

	app.get('/getLimitOrders', function(req, res){
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			Apis.instance().db_api().exec("get_limit_orders", [app.config.btc.id, app.config.asset.id, 10])
			.then((orders) => {
				return res.send({status: true, orders: orders});
			})
			.catch((err) => {
				console.log(err);
				return res.send({status: false});
			});
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});

	app.post('/cancelOrder', function(req, res){
		let order_id = '';
		if(!req.body || !req.body.order_id)
			order_id = '1.7.254206812';
		else
			order_id = req.body.order_id.trim();

		if(order_id == '')
			return res.send({status: false});

		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			let tr = new TransactionBuilder();

			tr.add_type_operation("limit_order_cancel", {
				fee: {
					amount: 0,
					asset_id: app.config.asset.id
				},
	        	fee_paying_account: app.config.account.id,
			    order: order_id
	        });

	        tr.set_required_fees(app.config.asset.id).then(() => {
	            tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
	            //console.log("serialized transaction:", tr.serialize());

	            tr.broadcast().then(function(){
	            	return res.send({status: true}) 
	            })
	            .catch((err) => {
	            	console.log(err);
	            	return res.send({status: false})
	            });
	        })
	        .catch((err) => {
	        	console.log(err);
	        	return res.send({status: false})
	        });
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});

	app.post('/createSellOrder', function(req, res){
		let current_price = 0;
		if(!req.body || !req.body.current_price || isNaN(req.body.current_price))
			current_price = 0.00000899;
		else
			current_price = parseFloat(parseFloat(req.body.current_price).toFixed(8));

		if(current_price <= 0)
			return res.send({status: false});

		let expiration = moment().add(1,'years').format('YYYY-MM-DDThh:mm:ss');
		
		Apis.instance(app.config.provider, true).init_promise.then((network) => {
			let vox_amount = parseInt(Math.random() * (max - min) + min);
			let btc_amount = parseFloat(parseFloat(current_price * vox_amount).toFixed(8));

			let tr = new TransactionBuilder();

			tr.add_type_operation("limit_order_create", {
	        	fee: {
	            	amount: 0,
			    	asset_id: app.config.asset.id
			    },
	        	seller: app.config.account.id,
			    amount_to_sell: {
			    	amount: vox_amount * (10 ** 7),
			    	asset_id: app.config.asset.id
			    },
			    min_to_receive: {
			    	amount: btc_amount * (10 ** 8),
			    	asset_id: app.config.btc.id
			    },
			    fill_or_kill: false,
			    expiration: expiration
	        });

	        tr.set_required_fees(app.config.asset.id).then(() => {
	            tr.add_signer(pKey, pKey.toPublicKey().toPublicKeyString());
	            //console.log("serialized transaction:", tr.serialize());

	            tr.broadcast().then(function(data){
	            	return res.send({status: true, order_id: data[0].trx.operation_results[0][1], order_amount: vox_amount}) 
	            })
	            .catch((err) => {
	            	console.log(err);
	            	return res.send({status: false})
	            });
	        })
	        .catch((err) => {
	        	console.log(err);
	        	return res.send({status: false})
	        });
		})
		.catch((err) => {
			console.log(err);
			return res.send({status: false});
		});
	});
}