// ───────────────────────────────────────────────────────────────────────────
// Opsguar-Notifier Business — Webhook de Media Type para Zabbix
// Envía notificaciones a un grupo de WhatsApp vía POST /api/send.
//
// Compatible con Zabbix 6.0 / 7.x / 8.x (motor Duktape, SOLO ES5:
//   sin const/let, sin arrow functions, sin template literals).
//
// Parámetros esperados (se definen en la Media Type):
//   URL       → endpoint de envío, ej: https://notificaciones.beonit.la/api/send
//   Token     → token de API del tenant, formato ogt_xxxxxxxx
//   GroupId   → JID del grupo de WhatsApp destino (suele venir de {ALERT.SENDTO})
//   Subject   → titular del mensaje  ({ALERT.SUBJECT})
//   Message   → cuerpo del mensaje   ({ALERT.MESSAGE})
//   HTTPProxy → (opcional) proxy HTTP
// ───────────────────────────────────────────────────────────────────────────

var OpsguarNotifier = {
    send: function (url, token, groupId, text, proxy) {
        var request = new HttpRequest();
        request.addHeader('Content-Type: application/json');
        request.addHeader('Authorization: Bearer ' + token);
        if (proxy) {
            request.setProxy(proxy);
        }

        var payload = JSON.stringify({ groupId: groupId, text: text });
        Zabbix.log(4, '[Opsguar-Notifier] POST ' + url + ' payload=' + payload);

        var response = request.post(url, payload);
        var status = request.getStatus();
        Zabbix.log(4, '[Opsguar-Notifier] respuesta HTTP ' + status + ': ' + response);

        var parsed = null;
        try { parsed = JSON.parse(response); } catch (e) { parsed = null; }

        // La API encola el mensaje y responde 202 Accepted (también acepta 200/201).
        if (status !== 200 && status !== 201 && status !== 202) {
            var detail = (parsed && parsed.message) ? parsed.message : response;
            if (status === 402) { detail = 'Cuota de mensajes agotada. ' + detail; }
            if (status === 403) { detail = 'Empresa suspendida o vigencia expirada. ' + detail; }
            if (status === 401) { detail = 'Token de API inválido o revocado. ' + detail; }
            throw 'HTTP ' + status + ' — ' + detail;
        }
        return parsed;
    }
};

try {
    var params = JSON.parse(value);

    if (!params.URL)     { throw 'Falta el parámetro "URL".'; }
    if (!params.Token)   { throw 'Falta el parámetro "Token" (ogt_...).'; }
    if (!params.GroupId) { throw 'Destino vacío: configura el "Send to" del medio con el JID del grupo de WhatsApp (ej: 120363xxxxxxxxx@g.us).'; }

    // Compone el texto: titular (Subject) + cuerpo (Message).
    var text = '';
    if (params.Subject) { text += params.Subject; }
    if (params.Message) { text += (text ? '\n\n' : '') + params.Message; }
    if (!text) { throw 'No hay contenido para enviar (Subject/Message vacíos).'; }

    OpsguarNotifier.send(params.URL, params.Token, params.GroupId, text, params.HTTPProxy);

    return 'OK';
}
catch (error) {
    Zabbix.log(3, '[Opsguar-Notifier] Error: ' + error);
    throw 'Envío fallido: ' + error;
}
