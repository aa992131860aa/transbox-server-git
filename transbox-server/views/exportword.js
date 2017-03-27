var officegen = require('officegen');
var fs = require('fs');
var path = require('path');
var docx = officegen ( 'docx' );
var async = require('async');


/**
 * ����word
 */
exports.exportWord = function(req, res) {
    console.log('exportWord-------------');
    docx.on ( 'finalize', function ( written ) {
                console.log ( 'Finish to create Word file.\nTotal bytes created: ' + written + '\n' );
            });


    docx.on ( 'error', function ( err ) {
                console.log ( err );
            });


    var pObj = docx.createP ( { align: 'center' } );// ������ ���þ���
    pObj.addText ( 'ѪҺ͸�����˹�������֪��ͬ����', { bold: true,font_face: 'Arial', font_size: 18 });// ������� ����������ʽ �Ӵ� ��С


    var pObj = docx.createP ();
    pObj.addText ( '����' );
    pObj.addText ( ' with color', { color: '000088' } );// ����������ɫ
    pObj.addText ( '�Ա�' );
    pObj.addText ( '', { color: '00ffff', back: '000088' } );
    pObj.addText ( '����' );
    pObj.addText ( '��', { color: '000088' } );


    var pObj = docx.createP ();
    pObj.addText ( '���סԺ����' );
    pObj.addText ( ' with color', { color: '000088' } );
    pObj.addText ( '���' );
    pObj.addText ( '', { color: '000088'} );


    var pObj = docx.createP ();
    pObj.addText ( 'һ��ѪҺ͸�����˹�������Ч��������ڹ����ˮ�ֺ�ù�أ������Ƽ��Ժ�������˥�ߵȼ�������Ч������' );
    var pObj = docx.createP ();
    pObj.addText ( '����ѪҺ͸�����˹�������ʱ��������Ҫ������ѪҺ�������⣬Ȼ��ͨ��͸�����˹��ȷ������ˮ�ֺ�ù�أ���������ѪҺ�ٻص��������⡣' );
    var pObj = docx.createP ();
    pObj.addText ( '����Ϊ����Ч����ѪҺ������ǰ��Ҫ����Ѫ��ͨ·�������������������ܣ���' );
    var pObj = docx.createP ();
    pObj.addText ( '�ġ�Ϊ��ֹѪҺ�������·��͸�����������̣�һ����Ҫ��͸��ǰ��͸��������ע����صȿ���ҩ�' );
    var pObj = docx.createP ();
    pObj.addText ( '�塢Ѫ͸�����к������ڼ��������ҽ�Ʒ��գ�����������غ��������Σ��������' );
    var pObj = docx.createP ();
    pObj.addText ( '1.��Ѫѹ������˥�ߣ��ļ�����������ʧ������Ѫ�����⣻' );
    var pObj = docx.createP ();
    pObj.addText ( '2.������˨����' );
    var pObj = docx.createP ();
    pObj.addText ( '3.������Ӧ��' );




    var out = fs.createWriteStream ( 'out.docx' );// �ļ�д��
    out.on ( 'error', function ( err ) {
        console.log ( err );
    });


    var result = docx.generate (out);// ���������word


    res.writeHead ( 200, {

// ע�������type���ã�������ͬ�ļ�typeֵ��ͬapplicationnd.openxmlformats-officedocument.presentationml.presentation
        "Content-Type": "applicationnd.openxmlformats-officedocument.wordprocessingml.document", 

 'Content-disposition': 'attachment; filename=out.docx'

    });
    docx.generate (res);// �ͻ��˵���word




}