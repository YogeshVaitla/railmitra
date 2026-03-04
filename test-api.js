const fetch = require('node-fetch');

async function testPost() {
    try {
        const response = await fetch('https://railmitra-api.onrender.com/api/swaps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trainNo: 'TESTT',
                userId: 'some-device-uuid',
                currentCoachId: 'S1',
                currentSeatNo: 42,
                currentSeatType: 'MIDDLE',
                desiredSeatType: 'LOWER',
                journeyDate: '2026-03-05',
                reason: 'elderly',
            }),
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);
    } catch (err) {
        console.error('Error:', err);
    }
}

testPost();
