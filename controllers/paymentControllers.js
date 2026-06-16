
//ssl
const SSLCommerzPayment = require('sslcommerz-lts');
const dotenv = require('dotenv');
const asyncHandler = require('../middleware/asyncHandler');
dotenv.config();
const db = require("../models/index");
const ErrorResponse = require('../utils/errorresponse');
const { or } = require('sequelize');
const { PaymentDetail, Order } = db;
const CALLBACK_URL = process.env.NODE_ENV === 'dev' ? process.env.DEV_DOMAIN : process.env.LIVE_DOMAIN;
const HOST_URL = process.env.NODE_ENV === 'dev' ? process.env.DEV_HOST : process.env.LIVE_HOST;
const ADVANCED_PAY_MIN_THRESHOLD = 50;
//manual payment

// @route    POST /api/payment/manual
// @desc     Create payment
// @access   Protected 
const manualPayment = asyncHandler(async function (req, res, next) {
    const userId = req.user.id;

    const {
        payment_medium,
        advance_paid = 0,
        trx_id,
        order_id,
        acc_no,
        bank_details = {},
    } = req.body;

    const { bank_name, branch, routing_no } = bank_details;

    const order = await Order.findOne({ where: { id: order_id }, status: 'pending' });
    if (!order) {
        return next(new ErrorResponse('Order not found', 400));
    }

    if (!payment_medium === 'cod' && !acc_no) {
        return next(new ErrorResponse('Account No not given', 400));
    }
    //@more elaborate about bank info
    if (payment_medium === 'bank' && (!bank_details.bank_name || !bank_details.branch || !bank_details.routing_no)) {
        return next(new ErrorResponse('Proper bank details not given', 400));
    }

    else if ((payment_medium === 'bkash' || payment_medium === 'nagad' || payment_medium === 'rocket') && !trx_id) {
        return next(new ErrorResponse('Trx Id  not given', 400));
    }
    const total = +order.total; //net payable (to be paid)

    // Get total paid so far
    const totalPaid = await PaymentDetail.sum('advance_paid', {
        where: { order_id },
    }) || 0;

    const remaining = total - totalPaid;

    // Already fully paid
    if (remaining <= 0) {
        return next(new ErrorResponse('Order already fully paid', 400));
    }

    // First payment minimum check
    if (totalPaid === 0 && advance_paid < ADVANCED_PAY_MIN_THRESHOLD) {
        return next(
            new ErrorResponse(
                `Advance can't be less than ${ADVANCED_PAY_MIN_THRESHOLD} BDT`,
                400
            )
        );
    }

    // Overpayment protection
    // if (advance_paid > remaining) {
    //     return next(
    //         new ErrorResponse(
    //             `Payment exceeds remaining amount ${remaining} BDT`,
    //             400
    //         )
    //     );
    // }

    //second /remaining payment
    const exitPayment = await PaymentDetail.findOne({ where: { order_id, user_id: userId } })
    if (exitPayment) {
        const payment = await PaymentDetail.create({
            order_id,
            user_id: userId,
            payment_medium,
            advance_paid: total - exitPayment.advance_paid, // paid THIS time
            // advance_paid: exitPayment.payable_amount - advance_paid, // paid THIS time
            payable_amount: 0, // remaining after this payment
            trx_id,
            acc_no,
            bank_name,
            branch,
            routing_no,
            paid_at: new Date(),
        });

        if (payment) {
            await Order.update({
                status: 'processing',
                payment_status: 'paid'
            }, { where: { id: order_id } })
        }

        res.status(201).json({
            success: true,
            msg: 'Reamining Payment successful!',
            data: payment
        });
    }
    else {
        // Create payment
        const payment = await PaymentDetail.create({
            order_id,
            user_id: userId,
            payment_medium,
            advance_paid, // paid THIS time
            payable_amount: remaining - advance_paid, // remaining after this payment
            trx_id,
            acc_no,
            bank_name,
            branch,
            routing_no,
            paid_at: new Date(),
        });

        if (+order.total === +advance_paid) {
            await Order.update({
                status: 'processing',
                payment_status: 'paid'
            }, { where: { id: order_id } })
        }

        res.status(201).json({
            success: true,
            msg: 'Payment successful!',
            data: payment
        });

    }
});



//sslcommerz init
const initiateSSL = async (req, res) => {
    // console.log(`${req.protocol}://${req.get('host')}`)
    //using validate instead success url 
    let data = {
        ...req.body,
        currency: 'BDT',
        success_url: `${HOST_URL}/api/payments/ssl-validate`,
        fail_url: `${HOST_URL}/api/payments/ssl-fail`,
        cancel_url: `${HOST_URL}/api/payments/ssl-cancel`,
        ipn_url: `${HOST_URL}/api/payments/ssl-ipn`,
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Test',
        cus_email: 'test@yahoo.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Mymensingh',
        cus_state: 'Dhaka',
        cus_postcode: 2200,
        cus_country: 'BD',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'test Ship',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 2200,
        ship_country: 'Bangladesh',
        multi_card_name: 'mastercard',
        value_a: 'ref001_A',
        value_b: 'ref002_B',
        value_c: 'ref003_C',
        value_d: 'ref004_D'
    };

    const sslcommer = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASS, false) //true for live default false for sandbox
    const r1 = await sslcommer.init(data);
    return res.status(200).json({
        success: true,
        data: r1
    });

    //    res.redirect(r1.GatewayPageURL)

}

const SSLipn = async (req, res) => {
    return res.status(200).json({
        success: true,
        data: req.body
    });
}

const SSLsuccess = async (req, res, next) => {
    console.log('ssl success')
    req.val_id = req.body.val_id;
    next()
    //  res.redirect(`${CALLBACK_URL}/payment/success`)
}

const SSLfailure = async (req, res) => {
    console.log('fail : ' + req.body)
    return res.redirect(`${CALLBACK_URL}/payment/fail`)
}

const SSLcancel = async (req, res) => {
    console.log('cancel : ' + req.body)
    return res.redirect(`${CALLBACK_URL}/payment/fail`)
}

const SSLvalidate = async (req, res) => {
    //tran_id = order_id
    const sslcz = new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASS, false)
    const r1 = await sslcz.validate({ val_id: req.val_id })
    res.redirect(`${CALLBACK_URL}/orders/${r1.tran_id}?status=${r1.status}`)
}

module.exports = {
    manualPayment
}