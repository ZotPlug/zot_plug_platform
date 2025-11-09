// infra/rest_api/routes/devices.ts
import { Router, Request, Response } from 'express'
import {
    getAllDevices,
    getDeviceById,
    getAllDevicesByUserId,
    getDeviceIdByName,
    getAllReadingsByDeviceName,
    getLatestReadingByDeviceName,
    getEnergyStatsByDeviceName,
    getDevicePolicy,
    getFaultyDevices,
    addDevice,
    addPowerReadingByDeviceName,
    updateDevice,
    deleteDevice,
} from '../../pg_db/queries/devices'

const router = Router()

//=========================================================
// READ
//=========================================================

/**
 * GET /api/devices/getAllDevices - list devices
 */
router.get('/getAllDevices', async (req: Request, res: Response) => {
    try {
        const devices = await getAllDevices()
        res.json(devices)

    } catch (err) {
        console.error('Get device error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})

/**
 * GET /api/devices/getDeviceById/:id
 */
router.get('/getDeviceById/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const device = await getDeviceById(id)
        if (!device) return res.status(404).json({ error: 'Device not found' })

        res.json(device)

    } catch (err) {
        console.error('Get device by ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch device' })
    }
})

/**
 * GET /api/devices/getAllDevicesByUserId/:id - get all devices by user ID
 */
router.get('/getAllDevicesByUserId/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })


        const devices = await getAllDevicesByUserId(id)
        if (devices.length === 0) return res.status(404).json({ error: 'No devices found for this user' })

        res.json(devices)

    } catch (err) {
        console.error('Get devices by user ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})

/**
 * GET /api/devices/getDeviceIdByName/:deviceName
 */
router.get('/getDeviceIdByName/:deviceName', async (req: Request, res: Response) => {
    try {
        const deviceName = req.params.deviceName
        if (!deviceName) return res.status(400).json({ error: 'Missing device name' })

        const deviceId = await getDeviceIdByName(deviceName)
        if (!deviceId) return res.status(404).json({ error: 'Device not found' })

        res.json({ deviceName, id: deviceId })

    } catch (err) {
        console.error('Get device ID by name error:', err)
        res.status(500).json({ error: 'Failed to fetch device ID' })
    }
})

/**
 * GET /api/devices/getReadingsByDeviceName/:deviceName
 */
router.get('/getReadingsByDeviceName/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { from, to } = req.query

        // Can still filter by date if desired:
        const allReadings = await getAllReadingsByDeviceName(deviceName)
        if (!allReadings) return res.status(404).json({ error: 'Device not found' })

        let filtered = allReadings
        if (from)
            filtered = filtered.filter(r => new Date(r.recorded_at) >= new Date(from as string))
        if (to)
            filtered = filtered.filter(r => new Date(r.recorded_at) <= new Date(to as string))

        res.json(filtered)

    } catch (err) {
        console.error('Get readings by device error:', err)
        res.status(500).json({ error: 'Failed to fetch readings' })
    }
})

/**
 * GET /api/devices/getLatestReading/:deviceName
 */
router.get('/getLatestReading/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const latest = await getLatestReadingByDeviceName(deviceName)
        if (!latest) return res.status(404).json({ error: 'No readings found' })
        res.json(latest)
    } catch (err) {
        console.error('Get latest reading error:', err)
        res.status(500).json({ error: 'Failed to fetch latest reading' })
    }
})

router.get('/getEnergyStats/:deviceName/:periodType/:periodStart', async (req: Request, res: Response) => {
    try {
        const { deviceName, periodType, periodStart } = req.params
        const stats = await getEnergyStatsByDeviceName(deviceName, periodType as any, periodStart)
        if (!stats) return res.status(404).json({ error: 'Device or stats not found' })
        res.json(stats)
    } catch (err) {
        console.error('Get energy stats error:', err)
        res.status(500).json({ error: 'Failed to fetch energy stats' })
    }
})

router.get('/getDevicePolicy/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const policy = await getDevicePolicy(deviceName)
        if (!policy) return res.status(404).json({ error: 'No policy found' })
        res.json(policy)
    } catch (err) {
        console.error('Get device policy error:', err)
        res.status(500).json({ error: 'Failed to fetch device policy' })
    }
})


/**
 * GET /api/devices/getFaultyDevices - list faulty devices
 */
router.get('/getFaultyDevices', async (_req: Request, res: Response) => {
    try {
        const faultyDevices = await getFaultyDevices()
        res.json(faultyDevices)
    } catch (err) {
        console.error('Get faulty devices error:', err)
        res.status(500).json({ error: 'Failed to fetch faulty devices' })
    }
})




//=========================================================
// CREATE
//=========================================================

/**
 * POST /api/devices/addDeviceMap - create device and map owner
 */
router.post('/addDeviceMap', async (req: Request, res: Response) => {
    try {
        const { deviceName, userId } = req.body
        if (!deviceName || !userId) 
            return res.status(400).json({ error: 'Missing name or userId' })

        const device = await addDevice({ deviceName, userId })
        res.status(201).json(device)

    } catch (err: any) {
        if (err?.code === '23505') 
            return res.status(409).json({ error: 'Device name already exists' })
        
        console.error('Failed to create device', err)
        res.status(500).json({ error: 'Failed to create device' })

    }
})


//=========================================================
// UPDATE
//=========================================================

/**
 * PUT /api/devices/updateDevice/:id - partial update
 */
router.put('/updateDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const payload: any = {}
        if (req.body.name !== undefined) payload.name = req.body.name

        if (req.body.status !== undefined) payload.status = req.body.status

        if (req.body.last_seen !== undefined) payload.last_seen = req.body.last_seen

        payload.id = id

        const updated = await updateDevice(payload)
        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })

        res.json(updated)

    } catch (err) {
        console.error('Update device error: ', err)
        res.status(500).json({ error: 'Failed to update device' })
    }
})


/**
 * PUT /api/devices/updateEnergyUsage/:deviceName
 */
router.put('/updateEnergyUsage/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { cumulativeEnergy } = req.body

        if (!deviceName || cumulativeEnergy === undefined) 
            return res.status(400).json({ error: 'Missing deviceName or cumulativeEnergy' })

        const latest = await getLatestReadingByDeviceName(deviceName)
        if (!latest) return res.status(404).json({ error: 'Device or reading not found' })

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage: latest.voltage,
            current: latest.current,
            power: latest.power,
            cumulativeEnergy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update energy usage error:', err)
        res.status(500).json({ error: 'Failed to update energy usage' })
    }
})

/**
 * PUT /api/devices/updatePower/:deviceName
 */
router.put('/updatePower/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { power } = req.body

        if (!deviceName || power === undefined) 
            return res.status(400).json({ error: 'Missing deviceName or power' })

        const latest = await getLatestReadingByDeviceName(deviceName)
        if (!latest) return res.status(404).json({ error: 'Device or reading not found' })

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage: latest.voltage,
            current: latest.current,
            power,
            cumulativeEnergy: latest.cumulative_energy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update power error:', err)
        res.status(500).json({ error: 'Failed to update power' })
    }
})

/**
 * PUT /api/devices/updateCurrent/:deviceName
 */
router.put('/updateCurrent/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { current } = req.body
        
        if (!deviceName || current === undefined) 
            return res.status(400).json({ error: 'Missing deviceName or current' })

        const latest = await getLatestReadingByDeviceName(deviceName)
        if (!latest) return res.status(404).json({ error: 'Device or reading not found' })

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage: latest.voltage,
            current,
            power: latest.power,
            cumulativeEnergy: latest.cumulative_energy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update current error:', err)
        res.status(500).json({ error: 'Failed to update current' })
    }
})



//=========================================================
// DELETE
//=========================================================

/**
 * DELETE /api/devices/deleteDevice/:id - soft delete
 */
router.delete('/deleteDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const deleted = await deleteDevice(id)
        if (!deleted) return res.status(404).json({ error: 'Device not found' })

        res.json(deleted)
    } catch (err) {
        console.error('Delete device error', err)
        res.status(500).json({ error: 'Failed to delete device' })
    }
})

export default router
