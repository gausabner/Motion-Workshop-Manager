import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');

export const options = {
    scenarios: {
        morning_spike: {
            executor: 'ramping-arrival-rate',
            startRate: 50,
            timeUnit: '1s',
            preAllocatedVUs: 1000,
            maxVUs: 10000, // Scales to hit ~2M user equivalents in short bursts over instances
            stages: [
                { duration: '2m', target: 500 }, // Initial ramp-up as mechanics arrive (7:30 AM)
                { duration: '5m', target: 2000 }, // The 8:00 AM rush
                { duration: '10m', target: 5000 }, // Peak morning drop-offs and job creations
                { duration: '5m', target: 1000 }, // Slowing down towards 9:30 AM
                { duration: '2m', target: 0 },    // Cooling down
            ],
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1500'], // 95% of requests must resolve under 500ms
        error_rate: ['rate<0.01'], // Less than 1% error rate is acceptable under extreme load
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';
const TENANT_ID = 'stark-industries';

export default function () {
    // Simulate Mechanic PWA Workflow

    // 1. Mechanic authenticates and loads today's schedule
    const jobRes = http.get(`${BASE_URL}/api/v1/jobs?tenant=${TENANT_ID}&status=TODO`, {
        tags: { name: 'get_daily_jobs' }
    });

    const success1 = check(jobRes, {
        'jobs loaded': (r) => r.status === 200,
    });
    errorRate.add(!success1);

    // Simulate human reading time
    sleep(Math.random() * 3 + 1);

    // 2. Mechanic clocks into a random job
    const jobId = `job_${Math.floor(Math.random() * 100000)}`;
    const clockInRes = http.post(`${BASE_URL}/api/v1/jobs/${jobId}/clock-in`, JSON.stringify({
        tenant_id: TENANT_ID,
        mechanic_id: `tech_${Math.floor(Math.random() * 100)}`,
        timestamp: new Date().toISOString()
    }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'job_clock_in' }
    });

    const success2 = check(clockInRes, {
        'clocked in successfully': (r) => r.status === 200 || r.status === 201,
    });
    errorRate.add(!success2);

    sleep(Math.random() * 5 + 2); // Simulating time between actions
}
