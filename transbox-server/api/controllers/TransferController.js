/**
 * TransferController
 *
 * @description :: Server-side logic for managing Transfers
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var BaseController = require('./BaseController');
var Transaction = require('sails-mysql-transactions').Transaction;
var EventProxy = require('eventproxy');

module.exports = {
    create: function(req, res) {
        console.log('create a new transfer.' + (new Date()));
        if (!Transfer.isCreateParamsOk(req.body)) {
            BaseController.sendBadParams(res);
            return;
        }

        console.log('params is correct.');

        //request params
        var baseInfo = req.body.baseInfo;
        var to = req.body.to;
        var person = req.body.person;
        var organ = req.body.organ;
        var opo = req.body.opo;

        //object from db
        var boxInfoDb = {};
        var organInfoDb = {};
        var personInfoDb = {};
        var opoInfoDb = {};

        Transaction.start(function(err, transaction) {
            console.log('start transation');
            if (err) {
                // the first error might even fail to return a transaction object, so double-check.
                transaction && transaction.rollback();
                BaseController.sendDbError(err, res);
                return;
            }

            var createParams = {};
            var ep = new EventProxy();

            /* =============== step1: get box info =============== */
            var findBoxParams = {
                boxid: baseInfo.box_id,
                dbStatus: 'N',
                transferStatus: 'free'
            }
            Box.transact(transaction).findOne(findBoxParams).populate('hosp_id').exec(function(err, record) {
                console.log('step1');
                if (err) {
                    transaction.rollback();
                    BaseController.sendDbError(err, res);
                    return;
                }

                if (!record) {
                    transaction.rollback();
                    BaseController.sendNotFound('创建转运失败，该箱子目前不能使用或已经被删除', res);
                    return;
                }

                // the box is free
                record.hospital = Hospital.info(record.hosp_id);
                var boxInfo = Box.info(record);
                boxInfoDb = boxInfo;
                ep.emit('box', boxInfo);
            });


            /* =============== step2: get organ info =============== */
            ep.once('box', function(boxInfo) {
                console.log('step2');
                if (organ.dataType === 'db') {
                    var findOrgan = {
                        organid: organ.organid,
                        dbStatus: 'N'
                    }
                    var updateOrgan = Organ.getUpdateParams(organ);
                    if (Object.keys(updateOrgan).length > 0) {
                        Organ.transact(transaction).update(findOrgan, updateOrgan).exec(function(err, records) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (records.length > 0) {
                                Organ.transact(transaction).findOne(findOrgan).exec(function(err, record) {
                                    if (err) {
                                        transaction.rollback();
                                        BaseController.sendDbError(err, res);
                                        return;
                                    }

                                    if (!record) {
                                        transaction.rollback();
                                        BaseController.sendDbError('无法获取器官信息', res);
                                        return;
                                    }

                                    var organInfo = Organ.info(record);
                                    ep.emit('organ', organInfo);
                                });

                            } else {
                                transaction.rollback();
                                BaseController.sendDbError('修改器官信息失败', res);
                            }
                        });

                    } else {
                        Organ.transact(transaction).findOne(findOrgan).exec(function(err, record) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (!record) {
                                transaction.rollback();
                                BaseController.sendDbError('无法获取器官信息', res);
                                return;
                            }

                            var organInfo = Organ.info(record);
                            ep.emit('organ', organInfo);
                        });
                    }

                } else {
                    //create a organ record
                    var createOrganParams = {
                        segNumber: organ.segNumber,
                        type: organ.type,
                        bloodType: organ.bloodType,
                        bloodSampleCount: organ.bloodSampleCount,
                        organizationSampleType: organ.organizationSampleType,
                        organizationSampleCount: organ.organizationSampleCount
                    }

                    Organ.transact(transaction).create(createOrganParams).exec(function(err, record) {
                        if (err) {
                            transaction.rollback();
                            BaseController.sendDbError(err, res);
                            return;
                        }

                        if (!record) {
                            transaction.rollback();
                            BaseController.sendDbError('无法新建器官信息', res);
                            return;
                        }

                        var organInfo = Organ.info(record);
                        ep.emit('organ', organInfo);
                    });
                }
            });

            /* =============== step3: get transfer person info =============== */
            ep.once('organ', function(organInfo) {
                console.log('step3');
                if (person.dataType === 'db') {
                    var findPersonParams = {
                        transferPersonid: person.transferPersonid,
                        dbStatus: 'N'
                    }
                    TransferPerson.transact(transaction).findOne(findPersonParams).exec(function(err, record) {
                        if (err) {
                            transaction.rollback();
                            BaseController.sendDbError(err, res);
                            return;
                        }

                        if (!record) {
                            transaction.rollback();
                            BaseController.sendDbError('无法获取该转运人信息', res);
                            return;
                        }

                        var personInfo = TransferPerson.info(record);
                        ep.emit('person', personInfo);
                    });

                } else {
                    //create a new transfer person
                    var createPersonParams = {
                        name: person.name,
                        phone: person.phone,
                        organType: organInfo.type,
                        hosp_id: boxInfoDb.hospital.hospitalid
                    }

                    TransferPerson.transact(transaction).create(createPersonParams).exec(function(err, record) {
                        if (err) {
                            transaction.rollback();
                            BaseController.sendDbError(err, res);
                            return;
                        }

                        if (!record) {
                            transaction.rollback();
                            BaseController.sendDbError('无法创建转运人信息', res);
                            return;
                        }

                        var personInfo = TransferPerson.info(record);
                        ep.emit('person', personInfo);
                    });
                }
            });

            /* =============== step4: get opo info =============== */
            ep.once('person', function(personInfo) {
                console.log('step4');
                if (opo.dataType === 'db') {
                    var findOpo = {
                        opoid: opo.opoid,
                        dbStatus: 'N'
                    }

                    var updateOpo = Opo.getUpdateParams(opo);
                    if (Object.keys(updateOpo).length > 0) {
                        Opo.transact(transaction).update(findOpo, updateOpo).exec(function(err, records) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (records.length > 0) {
                                Opo.transact(transaction).findOne(findOpo).exec(function(err, record) {
                                    if (err) {
                                        transaction.rollback();
                                        BaseController.sendDbError(err, res);
                                        return;
                                    }

                                    if (!record) {
                                        transaction.rollback();
                                        BaseController.sendDbError('无法获取opo信息', res);
                                        return;
                                    }

                                    var opoInfo = Opo.info(record);
                                    ep.emit('opo', opoInfo);
                                });

                            } else {
                                transaction.rollback();
                                BaseController.sendDbError('无法获取opo信息', res);
                            }
                        });

                    } else {
                        Opo.transact(transaction).findOne(findOpo).exec(function(err, record) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (!record) {
                                transaction.rollback();
                                BaseController.sendDbError('无法获取opo信息', res);
                                return;
                            }

                            var opoInfo = Opo.info(record);
                            ep.emit('opo', opoInfo);
                        });
                    }

                } else {
                    //create a new opo
                    var updateOpo = Opo.getUpdateParams(opo);
                    if (Object.keys(updateOpo).length > 0) {
                        Opo.transact(transaction).create(updateOpo).exec(function(err, record) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (!record) {
                                transaction.rollback();
                                BaseController.sendDbError('无法获取opo信息', res);
                                return;
                            }

                            var opoInfo = Opo.info(record);
                            ep.emit('opo', opoInfo);
                        });

                    } else {
                        transaction.rollback();
                        BaseController.sendDbError('opo参数有误', res);
                    }
                }
            });

            /* =============== step5: update box status =============== */
            ep.once('opo', function(opoInfo) {
                console.log('step5');
                var findBox = {
                    boxid: boxInfoDb.boxid,
                    dbStatus: 'N'
                }
                var updateBox = {
                    transferStatus: 'transfering'
                }
                Box.transact(transaction).update(findBox, updateBox).exec(function(err, records) {
                    if (err) {
                        transaction.rollback();
                        BaseController.sendDbError(err, res);
                        return;
                    }

                    if (records.length > 0) {
                        var boxInfo2 = Box.info(records[0]);
                        ep.emit('boxUpdated', boxInfo2);

                    } else {
                        transaction.rollback();
                        BaseController.sendDbError('更新箱子状态失败', res);
                    }
                });
            });

            /* =============== step6: create a new transfer =============== */
            ep.all('box', 'organ', 'person', 'opo', 'boxUpdated', function(boxInfo, organInfo, personInfo, opoInfo, boxInfo2) {
                console.log('step6');
                //base info
                for (var key in baseInfo) {
                    createParams[key] = baseInfo[key];
                }

                //to info
                createParams.to_hosp_id = boxInfo.hospital.hospitalid;
                if (to.dataType === 'new') {
                    createParams.toHospName = to.toHospName;
                }

                //person info
                createParams.transferPerson_id = personInfo.transferPersonid;

                //organ info
                createParams.organ_id = organInfo.organid;

                //opo info
                createParams.opo_id = opoInfo.opoid;

                Transfer.transact(transaction).create(createParams).exec(function(err, record) {
                    if (err) {
                        transaction.rollback();
                        BaseController.sendDbError(err, res);
                        return;
                    }

                    if (!record) {
                        transaction.rollback();
                        BaseController.sendDbError('创建转运失败', res);

                    } else {
                        var findParams = {
                            transferid: record.transferid,
                            dbStatus: 'N'
                        }
                        Transfer.transact(transaction).findOne(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').exec(function(err, record) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (!record) {
                                transaction.rollback();
                                BaseController.sendDbError('创建转运失败', res);
                                return;
                            }

                            transaction.commit();
                            var transferInfo = Transfer.detailInfo(record);
                            BaseController.sendOk('新建转运成功', transferInfo, res);
                            //socket event
                            if (transferInfo.deviceType === 'web') {
                                console.log(transferInfo);
                                sails.sockets.broadcast(transferInfo.boxInfo.boxid, 'created', transferInfo);
                            }
                            //send msg
                            // var params = {
                            //     transferNumber: transferInfo.transferNumber,
                            //     segNumber: transferInfo.organInfo.segNumber,
                            //     url: Base.config.host + '/transbox/transportHtml/index.html',
                            //     type: 'create'
                            // }
                            // MSMService.sendMsg(transferInfo.transferPersonInfo.phone, params);
                        });
                    }
                });
            });
        });
    },
    getFirstByTransferid: function(req, res) {
        var transferid = req.params.transferid;
        var findParams = {
            transferid: transferid,
            dbStatus: 'N'
        }

        Transfer.findOne(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').exec(function(err, record) {
            if (err) {
                BaseController.sendDbError(err, res);
                return;
            }

            if (!record) {
                BaseController.sendNotFound('找不到该转运信息', res);
                return;
            }

            var transferInfo = Transfer.detailInfo(record);
            BaseController.sendOk('获取转运信息成功', transferInfo, res);
        });
    },
    getInfo: function(req, res) {
        var transferNumber = req.query.transferNumber;
        var organSegNumber = req.query.organSegNumber;

        if (!transferNumber || !organSegNumber) {
            BaseController.sendBadParams(res);
            return;
        }

        async.series([function(callback) {
            console.log('step1');
            //get organ info by organ segment number
            var findOrgan = {
                segNumber: organSegNumber,
                dbStatus: 'N'
            }
            Organ.findOne(findOrgan).exec(function(err, record) {
                if (err) {
                    BaseController.sendDbError(err, res);
                    return;
                }

                if (!record) {
                    BaseController.sendNotFound('器官段号有误', res);
                    return;
                }

                callback(null, 'organ');
            });

        }, function(callback) {
            console.log('step2');
            //get transfer info by transfer number
            var findParams = {
                transferNumber: transferNumber,
                dbStatus: 'N'
            }

            Transfer.findOne(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').populate('records', {
                sort: 'recordAt'
            }).exec(function(err, record) {
                if (err) {
                    BaseController.sendDbError(err, res);
                    return;
                }

                if (!record) {
                    BaseController.sendNotFound('找不到该转运信息', res);
                    return;
                }


                var transferInfo = Transfer.detailInfo(record);
                BaseController.sendOk('获取转运信息成功', transferInfo, res);

                callback(null, 'transfer');
            });

        }], function(err, results) {

        });
    },
    transferDone: function(req, res) {
        console.log('transfer done ....');
        var transferid = req.params.transferid;

        Transaction.start(function(err, transaction) {
            if (err) {
                console.log('666:' + err);
                // the first error might even fail to return a transaction object, so double-check.
                transaction && transaction.rollback();
                BaseController.sendDbError(err, res);
                return;
            }

            var ep = new EventProxy();

            /* =============== step1: get transfer info =============== */
            var findParams = {
                transferid: transferid,
                status: {
                    '!': ['done']
                }
            }

            Transfer.transact(transaction).findOne(findParams).exec(function(err, record) {
                if (err) {
                    transaction.rollback();
                    BaseController.sendDbError(err, res);
                    return;
                }

                if (!record) {
                    transaction.rollback();
                    BaseController.sendNotFound('找不到符合条件的转运信息', res);
                    return;
                }

                var transferInfo = Transfer.info(record);
                ep.emit('transfer', transferInfo);
            });

            /* =============== step2: update box info =============== */
            ep.once('transfer', function(transferInfo) {
                var findBox = {
                    boxid: transferInfo.box_id,
                    transferStatus: {
                        '!': ['free']
                    },
                    dbStatus: 'N'
                }

                var updateBox = {
                    transferStatus: 'free'
                }

                Box.transact(transaction).update(findBox, updateBox).exec(function(err, records) {
                    if (err) {
                        transaction.rollback();
                        BaseController.sendDbError(err, res);
                        return;
                    }

                    if (records.length > 0) {
                        var boxInfo = Box.info(records[0]);
                        ep.emit('box', boxInfo);

                    } else {
                        transaction.rollback();
                        BaseController.sendDbError('无法更新该转运对应箱子的状态', res);
                    }
                });
            });

            /* =============== step3: update transfer info =============== */
            ep.once('box', function(boxInfo) {
                var updateParams = {
                    status: 'done',
                    endAt: new Date()
                }
                Transfer.transact(transaction).update(findParams, updateParams).exec(function(err, records) {
                    if (err) {
                        transaction.rollback();
                        BaseController.sendDbError(err, res);
                        return;
                    }

                    if (records.length > 0) {

                        var transferInfo = Transfer.info(records[0]);

                        var findParams = {
                            dbStatus: 'N',
                            transferid: transferInfo.transferid
                        }
                        Transfer.transact(transaction).findOne(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').exec(function(err, record) {
                            if (err) {
                                transaction.rollback();
                                BaseController.sendDbError(err, res);
                                return;
                            }

                            if (!record) {
                                transaction.rollback();
                                BaseController.sendNotFound('找不到该转运信息', res);
                                return;
                            }

                            transaction.commit();
                            var transferInfo = Transfer.detailInfo(record);
                            BaseController.sendOk('更新转运状态成功', transferInfo, res);

                            //send msg
                            // var params = {
                            //     transferNumber: transferInfo.transferNumber,
                            //     segNumber: transferInfo.organInfo.segNumber,
                            //     url: Base.config.host + '/transbox/transportHtml/index.html',
                            //     type: 'done'
                            // }
                            // MSMService.sendMsg(transferInfo.transferPersonInfo.phone, params);

                        });

                    } else {
                        transaction.rollback();
                        BaseController.sendDbError('无法更新该转运的状态', res);
                    }
                });
            });
        });
    },
    getTransfers: function(req, res) {
        var start = req.query.start ? req.query.start : 0;
        var number = req.query.number ? req.query.number : 6;

        var findParams = {
            dbStatus: 'N',
            sort: 'createAt DESC'
        }

        if (req.query.type) {
            if (req.query.type === 'transfering') {
                findParams.status = {
                    '!': ['done']
                }

            } else {
                findParams.status = req.query.type;
            }
        }

        if (req.query.transferNumber) {
            findParams.transferNumber = {
                'like': '%' + req.query.transferNumber + '%'
            }
        }

        if (req.query.fromCity) {
            findParams.fromCity = req.query.fromCity;
        }

        if (req.query.beginDate && req.query.endDate) {
            findParams.startAt = {
                '>=': req.query.beginDate + ' 00:00:00',
                '<=': req.query.endDate + ' 23:59:59'
            }

        } else if (req.query.beginDate) {
            findParams.startAt = {
                '>=': req.query.beginDate + ' 00:00:00'
            }

        } else if (req.query.endDate) {
            findParams.startAt = {
                '<=': req.query.endDate + ' 23:59:59'
            }
        }

        var hospIds = [];
        var organIds = [];
        var personIds = [];

        async.series([function(callback) {
            //find hospitals
            if (req.query.toHospitalName) {
                var findHospParams = {
                    dbStatus: 'N',
                    name: {
                        'like': '%' + req.query.toHospitalName + '%'
                    }
                }

                Hospital.find(findHospParams).exec(function(err, records) {
                    if (err) {
                        return callback(err);
                    }

                    if (records && records.length > 0) {
                        for (var i = 0; i < records.length; i++) {
                            hospIds.push(records[i].hospitalid);
                        }

                        return callback(null, hospIds);

                    } else {
                        return callback(null);
                    }
                });

            } else {
                callback(null);
            }

        }, function(callback) {
            //find organs
            if (!req.query.organSegNumber && !req.query.organType) {
                callback(null);
            } else {
                var findOrganParams = {
                    dbStatus: 'N'
                }

                if (req.query.organSegNumber) {
                    findOrganParams.segNumber = {
                        'like': '%' + req.query.organSegNumber + '%'
                    };
                }

                if (req.query.organType) {
                    findOrganParams.type = {
                        'like': '%' + req.query.organType + '%'
                    };
                }

                Organ.find(findOrganParams).exec(function(err, records) {
                    if (err) {
                        return callback(err);
                    }

                    if (records && records.length > 0) {
                        for (var i = 0; i < records.length; i++) {
                            organIds.push(records[i].organid);
                        }

                        return callback(null, organIds);

                    } else {
                        return callback(null);
                    }
                });
            }

        }, function(callback) {
            //find transfer persons
            if (req.query.transferPersonName) {
                var findPersonParams = {
                    dbStatus: 'N',
                    name: req.query.transferPersonName
                }
                TransferPerson.find(findPersonParams).exec(function(err, records) {
                    if (err) {
                        return callback(err);
                    }

                    if (records && records.length > 0) {
                        for (var i = 0; i < records.length; i++) {
                            personIds.push(records[i].transferPersonid);
                        }

                        return callback(null, personIds);

                    } else {
                        return callback(null);
                    }
                });

            } else {
                return callback(null);
            }

        }], function(err, results) {
            if (err) {
                BaseController.sendDbError(err, res);
                return;
            }

            if (hospIds.length > 0) {
                findParams.to_hosp_id = hospIds;
            }

            if (organIds.length > 0) {
                findParams.organ_id = organIds;
            }

            if (personIds.length > 0) {
                findParams.transferPerson_id = personIds;
            }

            if (req.query.hospitalid) {
                findParams.to_hosp_id = req.query.hospitalid;
            }

            console.log(findParams);
            Transfer.find(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').exec(function(err, records) {
                if (err) {
                    BaseController.sendDbError(err, res);
                    return;
                }

                // var transfers = [];
                // for (var i = 0; i < records.length; i++) {
                //     var transferInfo = Transfer.detailInfo(records[i]);
                //     transfers.push(transferInfo);
                // }
                // BaseController.sendOk('获取转运信息成功', transfers, res);

                var transfers = [];
                for (var i = parseInt(start); i < parseInt(start) + parseInt(number); i++) {
                    if (i < records.length) {
                        transfers.push(Transfer.detailInfo(records[i]));

                    } else {
                        break;
                    }
                }

                var info = {
                    totalItems: records.length,
                    numberOfPages: Math.ceil(parseFloat(records.length) / number),
                    transfers: transfers
                }

                BaseController.sendOk('获取转运信息成功', info, res);
            });

        });

    },
    getExportFile: function(req, res) {
        var transferid = req.params.transferid;
        var findParams = {
            transferid: transferid,
            dbStatus: 'N'
        }


        async.series([function(callback) {
            //get temperature records
            var sql = "select count(*) as tempCount from transferRecord where type&1 and transfer_id='" + transferid + "'";
            TransferRecord.query(sql, function(err, records) {
                if (err) {
                    return callback(err);
                }
                callback(null, records[0].tempCount);
            });

        }, function(callback) {
            //get collision info
            var sql = "select count(*) as collisionCount from transferRecord where type&4 and transfer_id='" + transferid + "'";
            TransferRecord.query(sql, function(err, records) {
                if (err) {
                    return callback(err);
                }
                callback(null, records[0].collisionCount);
            });

        }], function(err, results) {
            if (err) {
                BaseController.sendDbError(err, res);
                return;
            }

            var badInfo = '';
            if (parseInt(results[0]) > 0) {
                badInfo.concat('温度异常：' + results[0]);
            }

            if (parseInt(results[1]) > 0) {
                badInfo = badInfo.length > 0 ? badInfo.concat('；碰撞：' + results[1]) : '碰撞：' + results[1];
            }

            badInfo = badInfo.length > 0 ? badInfo : '无';

            Transfer.findOne(findParams).populate('box_id').populate('opo_id').populate('organ_id').populate('transferPerson_id').populate('to_hosp_id').populate('records', {
                sort: 'recordAt DESC',
                limit: 1
            }).exec(function(err, record) {
                if (err) {
                    BaseController.sendDbError(err, res);
                    return;
                }

                if (!record) {
                    BaseController.sendNotFound('找不到该转运信息', res);
                    return;
                }

                var transferInfo = Transfer.detailInfo(record);
                transferInfo.badInfo = badInfo;
                if (!transferInfo.records || transferInfo.records.length < 1) {
                    var record = {
                        avgTemperature: '无记录'
                    }

                    transferInfo.records = [record];
                }

                if (!transferInfo.tracfficNumber) {
                    transferInfo.tracfficNumber = '';
                }

                res.attachment(transferInfo.transferNumber + '.html');
                res.render('export', {
                    transferInfo: transferInfo,
                });
            });
        });
    }
};