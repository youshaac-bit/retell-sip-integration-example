const {registerCall} = require('../../lib/utils');
const service = ({logger, makeService}) => {
  const svc = makeService({path: '/retell'});

  svc.on('session:new', async(session) => {
    session.locals = {logger: logger.child({call_sid: session.call_sid})};
    const {from, to, direction, call_sid} = session;
    logger.info({session}, `new incoming call: ${session.call_sid}`);

    session
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session));
  
    try {
      const retell_call_id = await registerCall(logger, {
        agent_id: process.env.RETELL_AGENT_ID,
        from,
        to,
        direction,
        call_sid,
        retell_llm_dynamic_variables: {
          /* https://docs.retellai.com/retell-llm/dynamic-variables#phone-calls-with-your-own-numbers-custom-twilio */
          user_name: 'John Doe',
          user_email: 'john@example.com'
        }
      });
      logger.info({retell_call_id}, 'Call registered');

      session
        .dial({
          callerId: from,
          answerOnBridge: true,
          target: [
            {
              type: 'sip',
              sipUri: `sip:${retell_call_id}@5t4n6j0wnrl.sip.livekit.cloud`
            }
          ]
        })
        .hangup()
        .send();
    } catch (err) {
      session.locals.logger.info({err}, `Error to responding to incoming call: ${session.call_sid}`);
      session.close();
    }
  });
};

const onClose = (session, code, reason) => {
  const {logger} = session.locals;
  logger.info({session, code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

module.exports = service;
