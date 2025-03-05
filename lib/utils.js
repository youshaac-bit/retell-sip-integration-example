const {request} = require('undici');

const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

/**
 * https://docs.retellai.com/api-references/register-phone-call
 */
const registerCall = async(logger, {
  agent_id,
  from,
  to,
  direction,
  call_sid,
  retell_llm_dynamic_variables
}) => {

  try {
    const payload = {
      agent_id,
      from_number: from,
      to_number: to,
      metadata: {
        from,
        to,
        direction,
        call_sid,
      },
      retell_llm_dynamic_variables: retell_llm_dynamic_variables ? retell_llm_dynamic_variables : {}
    };
    const {statusCode, body} = await request('https://api.retellai.com/v2/register-phone-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const data = await body.json();
    if (statusCode !== 201 || !data?.call_id) {
      logger.error({statusCode, data}, 'Error registering call');
      throw new Error(`Error registering call: ${data.error_message}`);
    }
    logger.info({call_id: data.call_id}, 'Call registered');
    return data.call_id;
  } catch (err) {
    logger.error(err, 'Error registering call');
    throw err;
  }
};

const getE164 = async(number, country) => {
  const n = phoneUtil.parseAndKeepRawInput(number, country);
  if (!phoneUtil.isValidNumber(n)){
    logger.warn(`to: ${number} is not a valid phone number in ${country}`)
  }
  return phoneUtil.format(n, PNF.E164)//.replace('+', '') //Strip the +
}

const validateCountryCode= async(code) => {
    // list created by https://www.npmjs.com/package/i18n-iso-countries but hard coded as they hardley ever change so avoids adding more dependencies
    countries = ["AF","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BV","BR","IO","BN","BG","BF","BI","KH","CM","CA","CV","KY","CF","TD","CL","CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MP","MK","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RE","RO","RU","RW","SH","KN","LC","PM","VC","WS","SM","ST","SA","SN","SC","SL","SG","SK","SI","SB","SO","ZA","GS","ES","LK","SD","SR","SJ","SZ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","AX","BQ","CW","GG","IM","JE","ME","BL","MF","RS","SX","SS","XK"]
    if (countries.includes(code)){
      return true
  } else {
      throw new Error('Invalid DEFAULT COUNTRY, must contain ISO-3166-1-alpha2 values')
  }
}

module.exports = { registerCall, getE164, validateCountryCode };
