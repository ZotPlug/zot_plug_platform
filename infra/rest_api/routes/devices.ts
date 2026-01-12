// infra/rest_api/routes/devices.ts
import { Router, Request, Response } from 'express'
import {
    getAllDevices,
    getDeviceById,
    getDeviceIdByName,
    getAllDevicesByUserId,
    getLatestReadings,
    getEnergyStats,
    getAllReadingsPerDevice,
    getReadingsInRange,
    getDevicePolicy,
    getFaultyDevices,
    addDevice,
    addPowerReadings,
    updateDevice,
    upsertDeviceEnergyStat,
    upsertDeviceImage,
    upsertDevicePolicy,
    deleteDevice,
} from '../../pg_db/queries/devices'

const router = Router()

//=========================================================
// HELPER FUNCTIONS
//=========================================================
const getStringQuery = (value: any): string | undefined => {
    if (!value) return undefined
    if (Array.isArray(value)) return String(value[0])
    return String(value)
}

const getNumberQuery = (value: any): number | undefined => {
    const str = getStringQuery(value)
    if (!str) return undefined
    const num = Number(str)
    return Number.isNaN(num) ? undefined : num
}


//=========================================================
// READ
//=========================================================

/**
* @swagger
* tags:
*   name: Devices
*   description: The device management API.
* /devices/getAllDevices:
*   get:
*     summary: Get all devices that haven't been deleted
*     tags: [Devices]
*     responses:
*       200:
*         description: The returned devices sorted by ID.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       500:
*         description: Failed to fetch devices.
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
* @swagger
* /devices/getDeviceById/{id}:
*   get:
*     summary: Get a device by a specific id.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the device to retrieve
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid device id.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch device.
*/
router.get('/getDeviceById', async (req: Request, res: Response) => {
    try {
        const id = getNumberQuery(req.query.id)
        if (id === undefined || id === null) return res.status(400).json({ error: 'Invalid or missing id' })

        const device = await getDeviceById(id)
        if (!device) return res.status(404).json({ error: 'Device not found' })

        res.json(device)
    } catch (err) {
        console.error('Get device by ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch device' })
    }
})


/**
* @swagger
* /devices/getDeviceIdByName/{deviceName}:
*   get:
*     summary: Get a device by name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 deviceName:
*                   type: string
*                 id:
*                   type: integer
*       400:
*         description: Missing device name.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch device ID.
*/
router.get('/getDeviceIdByName', async (req: Request, res: Response) => {
    try {
        const deviceName = getStringQuery(req.query.deviceName)
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
* @swagger
* /devices/getAllDevicesByUserId/{id}:
*   get:
*     summary: Get ll devices associated with a user ID.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the user whose devices we are looking for.
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid user id.
*       404:
*         description: No devices found for this user.
*       500:
*         description: Failed to fetch devices.
*/
router.get('/getAllDevicesByUserId', async (req: Request, res: Response) => {
    try {
        const userId = getNumberQuery(req.query.id)
        if (userId === undefined || userId === null) return res.status(400).json({ error: 'Invalid or missing user id' })

        const devices = await getAllDevicesByUserId(userId)
        if (!devices || devices.length === 0) return res.status(404).json({ error: 'No devices found for this user' })

        res.json(devices)
    } catch (err) {
        console.error('Get devices by user ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})


/**
* @swagger
* /devices/getLatestReading/{deviceName}:
*   get:
*     summary: Get the latest reading associated with a device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       404:
*         description: No readings found.
*       500:
*         description: Failed to fetch device reading.
*/
router.get('/getLatestReadings', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        const deviceName = getStringQuery(req.query.deviceName)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const latest = await getLatestReadings({ deviceId, deviceName })
        if (!latest) return res.status(404).json({ error: 'No readings found' })
        
        res.json(latest)
    } catch (err) {
        console.error('Get latest reading error:', err)
        res.status(500).json({ error: 'Failed to fetch latest reading' })
    }
})


/**
* @swagger
* /devices/getEnergyStats/{deviceName}/{periodType}/{periodStart}:
*   get:
*     summary: Get the aggregate energy stats associated with a specific device name for a particular duration based on a given start time.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*       - in: path
*         name: periodType
*         schema:
*           type: string
*         required: true
*         description: The type of period. (e.g. daily, weekly, monthly)
*       - in: path
*         name: periodStart
*         schema:
*           type: string
*         required: true
*         description: The starting time for this period
*     responses:
*       200:
*         description: The aggregated energy usage associated with the device name over a defined time period.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/EnergyDeviceStat'
*       404:
*         description: Device or stats not found.
*       500:
*         description: Failed to fetch energy stats.
*/
router.get('/getEnergyStats', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        const deviceName = getStringQuery(req.query.deviceName)
        const periodType = getStringQuery(req.query.periodType)
        const periodStart = getStringQuery(req.query.periodStart)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })
        if (!periodType || !periodStart) return res.status(400).json({ error: 'Missing periodType or periodStart' })

        const validPeriods = ['daily', 'weekly', 'monthly']
        if (!validPeriods.includes(periodType)) return res.status(400).json({ error: 'Invalid periodType' });

        const stats = await getEnergyStats({ deviceId, deviceName }, periodType as any, periodStart)
        if (!stats || stats.length === 0) return res.status(404).json({ error: 'Device or stats not found' })
        
        res.json(stats)
    } catch (err) {
        console.error('Get energy stats error:', err)
        res.status(500).json({ error: 'Failed to fetch energy stats' })
    }
})


/**
* @swagger
* /devices/getReadingsByDeviceName/{deviceName}:
*   get:
*     summary: Get the readings associated with a device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/DeviceReading'
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch readings.
*/
router.get('/getAllReadingsPerDevice', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        const deviceName = getStringQuery(req.query.deviceName)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const readings = await getAllReadingsPerDevice({ deviceId, deviceName })
        if (!readings || readings.length === 0) return res.status(404).json({ error: 'Device not found' })
        
        res.json(readings)
    } catch (err) {
        console.error('Get readings by device error:', err)
        res.status(500).json({ error: 'Failed to fetch readings' })
    }
})


/**
* @swagger
* /devices/getReadingsByDeviceNameInRange/{deviceName}:
*   get:
*     summary: Get the readings associated with a device by its device name within a specified time range (from-to ISO timestamps).
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to lookup data for.
*       - in: query
*         name: from
*         schema:
*           type: string
*         required: true
*         description: The starting time (ISO timestamps)
*       - in: query
*         name: to
*         schema:
*           type: string
*         required: true
*         description: The ending time (ISO timestamps)
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing from or to query parameters.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch readings by device in range.
*/
router.get('/getReadingsInRange', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        const deviceName = getStringQuery(req.query.deviceName)
        const from = getStringQuery(req.query.from)
        const to = getStringQuery(req.query.to)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })
        if (!from || !to) return res.status(400).json({ error: 'Missing from or to query parameters' })

        const readings = await getReadingsInRange({ deviceId, deviceName }, from, to)
        if (!readings || readings.length === 0) return res.status(404).json({ error: 'Device not found' })
        
        res.json(readings)
    } catch (err) {
        console.error('Get readings by device in range error:', err)
        res.status(500).json({ error: 'Failed to fetch readings' })
    }
})


/**
* @swagger
* /devices/getDevicePolicy/{deviceName}:
*   get:
*     summary: Get the device policy associated with this device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The policy associated with the device name.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DevicePolicy'
*       404:
*         description: No policy found.
*       500:
*         description: Failed to fetch device policy.
*/
router.get('/getDevicePolicy', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        const deviceName = getStringQuery(req.query.deviceName)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const policy = await getDevicePolicy({ deviceId, deviceName })
        if (!policy) return res.status(404).json({ error: 'No policy found' })
        
        res.json(policy)
    } catch (err) {
        console.error('Get device policy error:', err)
        res.status(500).json({ error: 'Failed to fetch device policy' })
    }
})


/**
* @swagger
* /devices/getAllDevices:
*   get:
*     summary: Get all faulty devices that haven't been deleted
*     tags: [Devices]
*     responses:
*       200:
*         description: The returned devices sorted by last seen.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       500:
*         description: Failed to fetch devices.
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
* @swagger
* /devices/addDeviceMap:
*   post:
*     summary: Create device and map owner
*     tags: [Devices]
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 deviceName:
*                   type: string
*                 userId:
*                   type: integer
*     responses:
*       201:
*         description: The user was created.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Missing name or user id.
*       409:
*         description: Device name already exists.
*       500:
*         description: Failed to create device.
*
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
* @swagger
* /devices/updateDevice/{id}:
*   put:
*     summary: Update info related to the device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The id of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 name:
*                   type: string
*                 status:
*                   type: string
*                 last_seen:
*                   type: string
*                   format: date
*     responses:
*       200:
*         description: The updated device data.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid ID.
*       404:
*         description: Device not found or no changes applied.
*       500:
*         description: Failed to update device.
*/
router.put('/updateDevice', async (req: Request, res: Response) => {
    try {
        const { deviceId, deviceName, newDeviceName, status, lastSeen } = req.body

        if (!deviceId && !deviceName)
            return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const updated = await updateDevice({
            deviceId,
            deviceName,
            newDeviceName,
            status,
            lastSeen
        })

        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })
        res.json(updated)

        // const id = Number(req.params.id)
        // if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        // const payload: any = {}
        // if (req.body.name !== undefined) payload.name = req.body.name

        // if (req.body.status !== undefined) payload.status = req.body.status

        // if (req.body.last_seen !== undefined) payload.last_seen = req.body.last_seen

        // payload.id = id

    } catch (err) {
        console.error('Update device error: ', err)
        res.status(500).json({ error: 'Failed to update device' })
    }
})

function ensureLatestReading(latest: any, deviceName: string) {
    // if no prior reading, seed one with zero values
    if (!latest) {
        console.warn(`[INFO] No previous reading found for ${deviceName}. Creating initial record.`)
        return { voltage: 0, current: 0, power: 0, cumulative_energy: 0, recorded_at: new Date().toISOString() }
    }

    return latest
}


/**
* @swagger
* /devices/updateAllReadings/{deviceName}:
*   put:
*     summary: Update all device measurement fields (voltage, current, power) and increment cumulative energy.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               required: 
*                   - voltage
*                   - current    
*                   - power
*                   - energyIncrement
*               properties:
*                   voltage:
*                       type: number
*                       description: New voltage reading (V).
*                       example: 120.5
*                   current:
*                       type: number
*                       description: New current reading (A).
*                       example: 0.85
*                   power:
*                       type: number
*                       description: New power reading (W). This value overwrites the previous measurement.
*                       example: 102.4
*                   energyIncrement:
*                       type: number
*                       description: >
*                           The amount of energy (Wh) to **add** to the existing cumulative energy total.
*                           This does *not* overwrite the stored cumulative energy; it increments it.
*                       example: 0.12
*     responses:
*       200:
*         description: New device reading entry recorded successfully.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing one or more required fields.
*       500:
*         description: Failed to update all readings.
*/
router.put('/updateAllReadings/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { voltage, current, power, energyIncrement } = req.body

        if (!deviceName || voltage === undefined || current === undefined || power === undefined || energyIncrement === undefined)
            return res.status(400).json({ error: 'Missing one of: deviceName, voltage, current, power, or energyIncrement' })

        const latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)

        const newCumulative = (latest.cumulative_energy ?? 0) + energyIncrement

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage,
            current,
            power,
            cumulativeEnergy: newCumulative,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)
    } catch (err) {
        console.error('Update all readings error:', err)
        res.status(500).json({ error: 'Failed to update all readings' })
    }
})

/**
* @swagger
* /devices/updateEnergyUsage/{deviceName}:
*   put:
*     summary: Update the energy usage statistics associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 cumulativeEnergy:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or cumulative energy.
*       500:
*         description: Failed to update energy usage.
*/
router.put('/updateEnergyUsage/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { cumulativeEnergy } = req.body

        if (!deviceName || cumulativeEnergy === undefined)
            return res.status(400).json({ error: 'Missing deviceName or cumulativeEnergy' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)

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
* @swagger
* /devices/updatePower/{deviceName}:
*   put:
*     summary: Update the power readings associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 power:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or power.
*       500:
*         description: Failed to update power.
*/
router.put('/updatePower/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { power } = req.body

        if (!deviceName || power === undefined)
            return res.status(400).json({ error: 'Missing deviceName or power' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)


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

/**
* @swagger
* /devices/updateReadings/{deviceName}:
*   put:
*     summary: Update the current and voltage readings associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 current:
*                   type: number
*                 voltage:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or current.
*       500:
*         description: Failed to update current.
*/
router.put('/updateReadings/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { current, voltage } = req.body

        if (!deviceName || current === undefined || voltage === undefined)
            return res.status(400).json({ error: 'Missing deviceName, current, or voltage' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage,
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
* @swagger
* /devices/deleteDevice/{id}:
*   delete:
*     summary: Deletes a given device from the database.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The id of the device to delete.
*     responses:
*       200:
*         description: The id of the soft-deleted device.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 id:
*                   type: integer
*       400:
*         description: Invalid id.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to delete the device.
*/
router.delete('/deleteDevice', async (req: Request, res: Response) => {
    try {
        const { deviceId, deviceName } = req.body
        if (!deviceId && !deviceName)
            return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const deleted = await deleteDevice({
            deviceId: deviceId ? Number(deviceId) : undefined,
            deviceName: deviceName ? String(deviceName) : undefined
        })

        if (!deleted) return res.status(404).json({ error: 'Device not found' })
        res.json(deleted)
    } catch (err) {
        console.error('Delete device error', err)
        res.status(500).json({ error: 'Failed to delete device' })
    }
})

export default router