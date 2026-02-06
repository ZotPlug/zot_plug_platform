import pool from './pg_db/db_config'

/**
 * Aggregates daily energy statistics for all devices.
 * Calculates total energy consumed, average power, and maximum power for each device for the previous day.
 * Inserts or updates the aggregated data into the daily_energy_stats table.
 */
async function aggregateDailyEnergy(date = new Date()) {
    // we aggregate YESTERDAY's data
    const dayStart = new Date(date)
    dayStart.setDate(dayStart.getDate() - 1)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(dayStart)
    dayEnd.setHours(23, 59, 59, 999)

    // console.log(`[AGG] Aggregating energy for ${dayStart.toDateString()}`)
    
    await pool.query(`
        INSERT INTO device_energy_stats (
            device_id, 
            period_type, 
            period_start,
            total_energy,
            avg_power,
            max_power, 
            updated_at
        ) 
        SELECT 
            pr.device_id,
            'daily' AS period_type,
            $1::date AS period_start,
            MAX(pr.cumulative_energy) - MIN(pr.cumulative_energy) AS total_energy,
            AVG(pr.power) AS avg_power,
            MAX(pr.power) AS max_power,
            NOW() AS updated_at
        FROM power_readings pr
        WHERE pr.recorded_at >= $1 
            AND pr.recorded_at <= $2
        GROUP BY pr.device_id
        ON CONFLICT (device_id, period_type, period_start)
        DO UPDATE SET
            total_energy = EXCLUDED.total_energy,
            avg_power = EXCLUDED.avg_power,
            max_power = EXCLUDED.max_power,
            updated_at = EXCLUDED.updated_at
    `, [dayStart, dayEnd])

    // console.log(`[AGG] Daily energy aggregation completed for ${dayStart.toDateString()}`)
}

aggregateDailyEnergy()
    .then(async () => {
        await pool.end()
        process.exit(0)
    })
    .catch(async (err) => {
        console.error('Error aggregating daily energy:', err)
        await pool.end()
        process.exit(1)
    })


