// Opsguar-Notifier Business - webhook de Media Type para Zabbix 6.0 / 7.x / 8.x
// Envia la alerta a un grupo de WhatsApp via POST /api/send (JSON, 202 Accepted).
// Motor Duktape: SOLO ES5 (sin const/let, arrow functions ni template literals).
// Este archivo es la fuente: el script del YAML debe ser identico
// (lo comprueba tests/zabbixWebhook.test.js).
//
// Parametros de la Media Type:
//   URL       https://notificaciones.beonit.la/api/send
//   Token     {$OPSGUARD.TOKEN}  (macro global SECRETA con el token ogt_...)
//   GroupId   {ALERT.SENDTO}     (JID del grupo: 120363xxxxxxxxx@g.us)
//   Subject   {ALERT.SUBJECT}
//   Message   {ALERT.MESSAGE}
//   HTTPProxy (opcional)
var OpsguarNotifier = {
    MAX_TEXT: 8000,

    validate: function (params) {
        if (!params.URL || params.URL.indexOf('http') !== 0) {
            throw 'Parametro "URL" vacio o invalido.';
        }
        if (!params.Token || params.Token.indexOf('{$') === 0 || params.Token.indexOf('<') === 0) {
            throw 'Token sin configurar: define la macro global secreta {$OPSGUARD.TOKEN} con el token ogt_...';
        }
        if (!params.GroupId || params.GroupId.indexOf('{ALERT.') === 0) {
            throw 'Destino vacio: el "Send to" del medio del usuario debe ser el JID del grupo (120363xxxxxxxxx@g.us).';
        }
        if (!/@g\.us$/.test(params.GroupId)) {
            throw 'Destino "' + params.GroupId + '" no es un JID de grupo (debe terminar en @g.us).';
        }
    },

    buildText: function (subject, message) {
        var text = '';
        if (subject) { text += subject; }
        if (message) { text += (text ? '\n\n' : '') + message; }
        if (!text) { throw 'No hay contenido para enviar (Subject/Message vacios).'; }
        if (text.length > OpsguarNotifier.MAX_TEXT) {
            text = text.substring(0, OpsguarNotifier.MAX_TEXT - 3) + '...';
        }
        return text;
    },

    send: function (url, token, groupId, text, proxy) {
        var request = new HttpRequest();
        request.addHeader('Content-Type: application/json');
        request.addHeader('Authorization: Bearer ' + token);
        if (proxy) {
            request.setProxy(proxy);
        }

        // No se registra el token; el texto solo con DebugLevel 4.
        Zabbix.log(4, '[Opsguar-Notifier] POST ' + url + ' groupId=' + groupId + ' text=' + text);
        var response = request.post(url, JSON.stringify({ groupId: groupId, text: text }));
        var status = request.getStatus();
        Zabbix.log(4, '[Opsguar-Notifier] HTTP ' + status + ': ' + response);

        var parsed = null;
        try { parsed = JSON.parse(response); } catch (e) { parsed = null; }

        if (status === 200 || status === 201 || status === 202) {
            return (parsed && parsed.data && parsed.data.jobId) ? parsed.data.jobId : '';
        }

        var detail = (parsed && parsed.message) ? parsed.message : String(response).substring(0, 200);
        if (status === 0)   { detail = 'Sin respuesta (DNS, TLS, proxy o firewall). ' + detail; }
        if (status === 400) { detail = 'Peticion invalida. ' + detail; }
        if (status === 401) { detail = 'Token de API invalido o revocado. ' + detail; }
        if (status === 402) { detail = 'Cuota de mensajes agotada. ' + detail; }
        if (status === 403) { detail = 'Empresa suspendida o fuera de vigencia. ' + detail; }
        throw 'HTTP ' + status + ' - ' + detail;
    }
};

try {
    var params = JSON.parse(value);
    OpsguarNotifier.validate(params);
    var text = OpsguarNotifier.buildText(params.Subject, params.Message);
    var jobId = OpsguarNotifier.send(params.URL, params.Token, params.GroupId, text, params.HTTPProxy);
    return jobId ? 'OK (job ' + jobId + ')' : 'OK';
}
catch (error) {
    Zabbix.log(3, '[Opsguar-Notifier] Error: ' + error);
    throw 'Envio fallido: ' + error;
}
