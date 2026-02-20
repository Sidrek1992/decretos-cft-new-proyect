const https = require('https');
const url = 'https://script.google.com/macros/s/AKfycbzpTshmKjY6-DkBOwjXKyiRsHcJDpsigzNNAYnkKcFO3pXWghO37cyrlCVyKGbjmfzh/exec?sheetId=14qgHA7YP4qoSbzD8rgMPW6OmqLIVFi8V-1VPxoUEDbI&type=employees';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const rows = json.data;
        console.log("Total rows from sheet:", rows.length);
        let validCount = 0;

        function validateRut(rut) {
            if (!rut || rut.length < 8) return false;
            var cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
            var body = cleanRut.slice(0, -1);
            var dv = cleanRut.slice(-1);
            if (!/^\d+$/.test(body)) return false;
            var sum = 0;
            var multiplier = 2;
            for (var i = body.length - 1; i >= 0; i--) {
                sum += parseInt(body[i]) * multiplier;
                multiplier = multiplier === 7 ? 2 : multiplier + 1;
            }
            var expectedDv = 11 - (sum % 11);
            var calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString();
            return dv === calculatedDv;
        }

        const dedupedRuts = new Set();
        const rejected = [];

        rows.forEach((r, i) => {
            const nombre = String(r[1] || '').trim();
            const ap1 = String(r[2] || '').trim();
            const ap2 = String(r[3] || '').trim();
            const rut = String(r[4] || '').trim();
            const fullName = `${nombre} ${ap1} ${ap2}`.trim();

            let reason = null;
            if (!nombre) { reason = "No tiene nombre (Columna B vacia)"; }
            else if (!rut) { reason = "No tiene RUT"; }
            else if (!validateRut(rut)) { reason = "RUT Invalido (Modulo 11)"; }
            else if (dedupedRuts.has(rut.replace(/[^0-9Kk]/g, '').toUpperCase())) { reason = "RUT Duplicado"; }

            if (reason) {
                rejected.push({ row: i + 2, name: fullName, rut, reason });
            } else {
                dedupedRuts.add(rut.replace(/[^0-9Kk]/g, '').toUpperCase());
                validCount++;
            }
        });

        console.log("Valid count:", validCount);
        console.log("Rejected:", rejected);
    });
});
