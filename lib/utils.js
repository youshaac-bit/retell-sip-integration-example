const {request} = require('undici');

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

module.exports = { registerCall };
