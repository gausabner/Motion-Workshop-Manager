(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Tokenizer = factory());
})(this, (function () { 'use strict';

    const url = 'https://sandbox.gotnpgateway.com';
    const pathUrl = '/api/tokenizer';
    class Tokenizer {
        id;
        apikey; // required
        url;
        amount;
        iframe;
        container = null;
        settings = { id: '', apikey: '', amount: '' };
        applePay = {
            btn: null,
        };
        constructor(info) {
            // Make sure apikey is set
            if (!info.apikey) {
                throw new Error('apikey must be set!');
            }
            // if apikey does not start with pub_ throw error
            if (!info.apikey.startsWith('pub_')) {
                throw new Error('apikey must be a public apikey and must start with pub_');
            }
            this.apikey = info.apikey;
            // Set url - if not set use what get set for https://sandbox.gotnpgateway.com
            this.url = (info.url && info.url !== '' ? info.url : url); // Use constructor url passed, or default url var
            // set amount
            if (info.amount) {
                this.amount = info.amount;
            }
            // Set values
            this.id = this.uuid();
            if (typeof info.settings === 'object') {
                this.settings = info.settings;
            }
            // Set callbacks
            if (info.onLoad) {
                this.onLoad = info.onLoad;
            }
            if (info.validCard) {
                this.validCard = info.validCard;
            }
            if (info.achOnChange) {
                this.achOnChange = info.achOnChange;
            }
            if (info.magStripeSwipe) {
                this.magStripeSwipe = info.magStripeSwipe;
            }
            if (info.onPaymentChange) {
                this.onPaymentChange = info.onPaymentChange;
            }
            if (info.submission) {
                this.submission = info.submission;
            }
            window.addEventListener('message', (e) => { this.messageListener(e); });
            this.iframe = this.buildIframe();
            this.waitForContainer(info.container, (el) => {
                // Check if element is in the DOM
                if (!el) {
                    throw new Error('Could not find container');
                }
                // Add onload to iframe
                this.iframe.onload = () => {
                    // Send settings to iframe
                    this.settings.id = this.id;
                    this.settings.apikey = this.apikey;
                    this.settings.amount = this.amount;
                    // Check payent types if string set to array
                    if (typeof this.settings.payment?.types === 'string') {
                        this.settings.payment.types = [this.settings.payment.types];
                        // If type is a string we need to implement an old way of dealing
                        // with force showing the payment selection
                        this.settings.payment.forcePaymentSelection = true;
                    }
                    this.setSettings(this.settings);
                    this.onLoad(); // Call on load
                };
                // Add iframe
                this.container = el;
                this.container.appendChild(this.iframe);
                this.initApplePay(el);
            });
        }
        // Only here because it used originally here from the begining
        // DO NOT REMOVE, some clients still call create even though it doesnt do anything anymore.
        create() { }
        getApiKeyURL() {
            return this.getTokenizerURL() + '/' + this.apikey;
        }
        getTokenizerURL() {
            return this.url.replace(/\/$/, '') + pathUrl;
        }
        initApplePay(container) {
            if (!this.settings?.payment?.types?.includes('apple_pay') && !this.settings?.payment?.applePay) {
                return;
            }
            const applePayScript = document.createElement('script');
            const applePaySDKUrl = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js';
            applePayScript.setAttribute('src', applePaySDKUrl);
            applePayScript.setAttribute('async', '');
            applePayScript.setAttribute('crossorigin', '');
            document.head.appendChild(applePayScript);
            this.populateApplePayBtn(container);
        }
        populateApplePayBtn(container) {
            this.applePay.btn = document.createElement('apple-pay-button');
            this.applePay.btn.setAttribute('buttonstyle', 'white');
            this.applePay.btn.setAttribute('type', 'pay');
            this.applePay.btn.setAttribute('locale', 'en-US');
            this.applePay.btn.style.setProperty('--apple-pay-button-width', '100%');
            this.applePay.btn.style.setProperty('--apple-pay-button-height', '20px');
            this.applePay.btn.style.borderRadius = '4px';
            this.applePay.btn.style.border = 'solid 1px #DCDEE2';
            this.applePay.btn.onclick = this.clickApplePay;
            container.appendChild(this.applePay.btn);
        }
        clickApplePay = () => {
            if (!ApplePaySession) {
                console.warn('Apple Pay is not available');
                return;
            }
            const applePayConfig = this.settings?.payment?.applePay;
            if (!applePayConfig) {
                console.error('Apple Pay is missing from configuration');
                return;
            }
            // Create ApplePaySession
            const defaultSupportedNetworks = [
                'amex', 'chinaUnionPay', 'discover', 'interac', 'masterCard', 'privateLabel', 'visa', // v1
                'jcb', // v2
                'cartesBancaires', 'eftpos', 'electron', 'elo', 'maestro', 'vPay', // v4
                'mada' // v5
            ];
            const session = new ApplePaySession(applePayConfig.version || 5, {
                countryCode: applePayConfig.payment.countryCode,
                currencyCode: applePayConfig.payment.currencyCode,
                total: applePayConfig.payment.total,
                // optional params with default values
                merchantCapabilities: applePayConfig.payment.merchantCapabilities || ['supports3DS'],
                supportedNetworks: applePayConfig.payment.supportedNetworks || defaultSupportedNetworks,
                // optional params
                supportedCountries: applePayConfig.payment.supportedCountries,
                lineItems: applePayConfig.payment.lineItems,
                requiredBillingContactFields: applePayConfig.payment.requiredBillingContactFields,
                requiredShippingContactFields: applePayConfig.payment.requiredShippingContactFields,
            });
            session.onvalidatemerchant = async (event) => {
                fetch(`${this.url}/api/public/applepay/validatemerchant`, {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        PKeyCompany: applePayConfig.key,
                        AppleMerchantId: applePayConfig.appleMerchantID,
                        ValidationUrl: event.validationURL,
                        domainName: applePayConfig.domainName
                    })
                })
                    .then(data => data.json())
                    .then(data => session.completeMerchantValidation(data))
                    .catch(() => {
                    console.error('merchant validation failed');
                    session.completeMerchantValidation({ error: 'merchant validation failed' });
                });
            };
            session.onpaymentauthorized = (event) => {
                // Define ApplePayPaymentAuthorizationResult
                applePayConfig.autoPay(event).then((msg) => {
                    this.submission({
                        status: msg,
                    });
                    if (msg === 'success') {
                        session.completePayment(ApplePaySession.STATUS_SUCCESS);
                    }
                    else {
                        session.completePayment(ApplePaySession.STATUS_FAILURE);
                    }
                }).catch(() => {
                    session.completePayment(ApplePaySession.STATUS_FAILURE);
                });
            };
            try {
                session.begin();
            }
            catch (e) {
                console.error(e);
            }
        };
        // hideAutoPayButtons is hiding ApplePay and Google Pay's "Pay" buttons
        hideAutoPayButtons(type) {
            if (type !== '' && type !== 'apple_pay') {
                this.applePay.btn?.remove();
                this.applePay.btn = null;
            }
            else {
                this.waitForContainer(this.container, (el) => {
                    if (!el) {
                        return;
                    }
                    if (!this.applePay.btn) {
                        this.populateApplePayBtn(el);
                    }
                });
            }
        }
        // Check if state is surchargeable, pretty primative but works for now
        isSurchargeable(state, bin) {
            const blacklist = ['CO', 'CT', 'ME', 'MA'];
            if (state === '') {
                return false;
            }
            if (blacklist.indexOf(state.toUpperCase()) !== -1) {
                return false;
            }
            if (!bin || !bin.card_type || bin.card_type.toLowerCase() !== 'credit') {
                return false;
            }
            return true;
        }
        // Post message to iframe
        submit(amount) {
            // If there is guardian data send data to iframe
            this.getGuardianData().then((guardianResult) => {
                if (guardianResult.events?.length) {
                    this.postMessage({
                        event: 'setGuardian',
                        data: guardianResult
                    });
                }
            }).then(() => {
                this.postMessage({
                    event: 'submit',
                    data: { amount: amount }
                });
            }).catch(() => {
                this.postMessage({
                    event: 'submit',
                    data: { amount: amount }
                });
            });
        }
        // Pass exp date to be set inside form
        setExpDate(expDate) {
            this.postMessage({
                event: 'setExpDate',
                data: { value: expDate }
            });
        }
        setError(input) {
            this.postMessage({
                event: 'setError',
                data: { input: input }
            });
        }
        setBilling(address) {
            this.postMessage({
                event: 'setBilling',
                data: address
            });
        }
        setShipping(address) {
            this.postMessage({
                event: 'setShipping',
                data: address
            });
        }
        // Communicate back to child
        postMessage(msg) {
            const w = this.iframe.contentWindow;
            if (w !== null) {
                const data = JSON.stringify(msg);
                w.postMessage(data, '*');
            }
        }
        onLoad = () => { };
        validCard = () => { };
        achOnChange = () => { };
        magStripeSwipe = () => { };
        onPaymentChange = () => { };
        submission = () => { };
        errorPass = () => { };
        uuid() {
            function s4() { return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1); }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        }
        waitForContainer(selector, callback) {
            if (!selector) {
                callback(null);
                return;
            }
            const startTimeInMs = Date.now();
            const checkFrequencyInMs = 1000;
            const timeoutInMs = 10000;
            (function loopSearch() {
                if (typeof selector === 'string' && document.querySelector(selector) !== null) {
                    callback(document.querySelector(selector));
                    return;
                }
                else if (typeof selector !== 'string' && selector) {
                    callback(selector);
                    return;
                }
                else {
                    setTimeout(() => {
                        if (Date.now() - startTimeInMs > timeoutInMs) {
                            callback(null);
                            return;
                        }
                        loopSearch();
                    }, checkFrequencyInMs);
                }
            })();
        }
        buildIframe() {
            const iframe = document.createElement('iframe');
            iframe.src = this.getApiKeyURL();
            // Set allow payment request
            iframe.setAttribute('allow', 'payment');
            // Style
            iframe.style.display = 'block';
            iframe.style.border = 'none';
            iframe.style.margin = '0px';
            iframe.style.padding = '0px';
            iframe.style.width = '1px';
            iframe.style.minWidth = '100%';
            iframe.style.height = '30px';
            iframe.style.overflow = 'hidden';
            iframe.style.backgroundColor = 'transparent';
            iframe.style.transition = 'all .3s ease-out';
            // Attributes
            iframe.frameBorder = '0';
            return iframe;
        }
        setSettings(settings) {
            this.postMessage({
                event: 'setSettings',
                data: settings
            });
        }
        updateHeight(height) {
            if (height) {
                this.iframe.style.height = height + 'px';
            }
        }
        getGuardianData() {
            const g = window.Guardian;
            if (g && g.getData && typeof g.getData === 'function') {
                return g.getData();
            }
            return Promise.reject();
        }
        messageListener(e) {
            try {
                const msg = JSON.parse(e.data);
                const id = msg.id;
                if (this.id !== id) {
                    return;
                } // Validate messages are communicating on the same id
                const event = msg.event;
                const data = msg.data;
                if (!event) {
                    return;
                }
                switch (event) {
                    case 'submission':
                        this.submission(data);
                        break;
                    case 'validCard':
                        this.validCard(data);
                        break;
                    case 'achOnChange':
                        this.achOnChange(data);
                        break;
                    case 'magStripeSwipe':
                        this.magStripeSwipe(data);
                        break;
                    case 'onPaymentChange':
                        this.onPaymentChange(data.type);
                        this.hideAutoPayButtons(data.type);
                        break;
                    case 'setHeight':
                        this.updateHeight(data.height);
                        break;
                }
            }
            catch (e) {
            }
        }
    }

    return Tokenizer;

}));
