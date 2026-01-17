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
    addReadings,
    updateDevice,
    upsertDeviceEnergyStats,
    upsertDeviceImage,
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

const getString = (value: any): string | undefined => {
    if (!value) return undefined
    if (Array.isArray(value)) return String(value[0])
    return String(value)
}

const getNumber = (value: any): number | undefined => {
    const str = getString(value)
    if (!str) return undefined
    const num = Number(str)
    return Number.isNaN(num) ? undefined : num
}

async function getLatest(deviceId?: number, deviceName?: string) {
    const latest = await getLatestReadings({ deviceId, deviceName })
    if (!latest) {
        console.warn(`[INFO] No previous reading found for ${deviceName || deviceId}. Creating initial record.`)
        return { voltage: 0, current: 0, power: 0, cumulative_energy: 0, recorded_at: new Date().toISOString() }
    }
    return latest
}

const ENERGY_PERIOD_TYPES = ["daily", "weekly", "monthly"] as const
type EnergyPeriodType = typeof ENERGY_PERIOD_TYPES[number]

function isEnergyPeriodType(value: any): value is EnergyPeriodType {
    return ENERGY_PERIOD_TYPES.includes(value)
}

//=========================================================
// READ
//=========================================================

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: Device management API.
 *
 * /devices/getAllDevices:
 *   get:
 *     summary: Get all active devices
 *     description: Returns all devices that have not been deleted, sorted by ID.
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Successfully retrieved devices.
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
 * /devices/getDeviceById:
 *   get:
 *     summary: Get a device by ID
 *     description: Retrieves a single device using its unique ID.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the device to retrieve.
 *     responses:
 *       200:
 *         description: Device successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       400:
 *         description: Invalid or missing device ID.
 *       404:
 *         description: Device not found.
 *       500:
 *         description: Failed to fetch device.
 */
router.get('/getDeviceById', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumberQuery(req.query.deviceId)
        if (deviceId === undefined || deviceId === null) return res.status(400).json({ error: 'Invalid or missing id' })

        const device = await getDeviceById(deviceId)
        if (!device) return res.status(404).json({ error: 'Device not found' })

        res.json(device)
    } catch (err) {
        console.error('Get device by ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch device' })
    }
})


/**
 * @swagger
 * /devices/getDeviceIdByName:
 *   get:
 *     summary: Get a device ID by name
 *     description: Retrieves the unique device ID for a given device name.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the device to look up.
 *     responses:
 *       200:
 *         description: Device ID successfully retrieved.
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
 * /devices/getAllDevicesByUserId:
 *   get:
 *     summary: Get all devices associated with a user
 *     description: Retrieves all devices linked to a specific user ID.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the user whose devices are being retrieved.
 *     responses:
 *       200:
 *         description: Devices successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Device'
 *       400:
 *         description: Invalid or missing user ID.
 *       404:
 *         description: No devices found for the specified user.
 *       500:
 *         description: Failed to fetch devices.
 */
router.get('/getAllDevicesByUserId', async (req: Request, res: Response) => {
    try {
        const userId = getNumberQuery(req.query.userId)
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
 * /devices/getLatestReadings:
 *   get:
 *     summary: Get the latest reading for a device
 *     description: Retrieves the most recent reading for a device identified by ID or name.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: false
 *         schema:
 *           type: integer
 *         description: The ID of the device.
 *       - in: query
 *         name: deviceName
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the device.
 *     responses:
 *       200:
 *         description: Latest device reading successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing deviceId or deviceName.
 *       404:
 *         description: No readings found for the specified device.
 *       500:
 *         description: Failed to fetch latest device reading.
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
        res.status(500).json({ error: 'Failed to fetch latest device reading' })
    }
})


/**
 * @swagger
 * /devices/getEnergyStats:
 *   get:
 *     summary: Get aggregate energy statistics for a device
 *     description: Retrieves aggregated energy usage statistics for a device over a specified time period.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: false
 *         schema:
 *           type: integer
 *         description: The ID of the device.
 *       - in: query
 *         name: deviceName
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the device.
 *       - in: query
 *         name: periodType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         description: The aggregation period type.
 *       - in: query
 *         name: periodStart
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: ISO timestamp representing the start of the period.
 *     responses:
 *       200:
 *         description: Aggregated energy statistics successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnergyDeviceStat'
 *       400:
 *         description: Missing or invalid parameters.
 *       404:
 *         description: Device or energy statistics not found.
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
 * /devices/getAllReadingsPerDevice:
 *   get:
 *     summary: Get all power readings for a device
 *     description: Retrieves all historical power readings for a device identified by ID or name.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: false
 *         schema:
 *           type: integer
 *         description: The ID of the device.
 *       - in: query
 *         name: deviceName
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the device.
 *     responses:
 *       200:
 *         description: Device readings successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing deviceId or deviceName.
 *       404:
 *         description: Device not found or no readings available.
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
 * /devices/getReadingsInRange:
 *   get:
 *     summary: Get device readings within a time range
 *     description: Retrieves power readings for a device within a specified time range using ISO timestamps.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: false
 *         schema:
 *           type: integer
 *         description: The ID of the device.
 *       - in: query
 *         name: deviceName
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the device.
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time of the range (ISO timestamp).
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time of the range (ISO timestamp).
 *     responses:
 *       200:
 *         description: Device readings successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing or invalid query parameters.
 *       404:
 *         description: Device not found or no readings available in the given range.
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
        res.status(500).json({ error: 'Failed to fetch readings in range' })
    }
})


/**
 * @swagger
 * /devices/getDevicePolicy:
 *   get:
 *     summary: Get the active policy for a device
 *     description: Retrieves the policy configuration for a device identified by ID or name.
 *     tags: [Devices]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         required: false
 *         schema:
 *           type: integer
 *         description: The ID of the device.
 *       - in: query
 *         name: deviceName
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the device.
 *     responses:
 *       200:
 *         description: Device policy successfully retrieved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DevicePolicy'
 *       400:
 *         description: Missing deviceId or deviceName.
 *       404:
 *         description: No policy found for the specified device.
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
 * /devices/getFaultyDevices:
 *   get:
 *     summary: Get all devices currently marked as faulty
 *     description: Retrieves all devices that are flagged as faulty (e.g., due to repeated empty payloads) and have not been deleted. Results are sorted by `last_seen` descending.
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: List of faulty devices.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Device'
 *       500:
 *         description: Failed to fetch faulty devices.
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
 * /devices/addDevice:
 *   post:
 *     summary: Create a new device and assign it to an owner
 *     description: Creates a new device record and maps the specified user as the device owner. Returns the created device object.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceName
 *               - userId
 *             properties:
 *               deviceName:
 *                 type: string
 *                 description: The unique name of the device to create
 *               userId:
 *                 type: integer
 *                 description: The ID of the user to be assigned as the owner
 *     responses:
 *       201:
 *         description: Device successfully created and mapped to owner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       400:
 *         description: Missing `deviceName` or `userId` in request. 
 *       409:
 *         description: Device with this name already exists.
 *       500:
 *         description: Failed to create device.
 */
router.post('/addDevice', async (req: Request, res: Response) => {
    try {
        const { deviceName, userId } = req.body
        if (!deviceName || !userId) return res.status(400).json({ error: 'Missing name or userId' })

        const device = await addDevice({ deviceName, userId })
        res.status(201).json(device)

    } catch (err: any) {
        if (err?.code === '23505') return res.status(409).json({ error: 'Device name already exists' })
        console.error('Failed to create device', err)
        res.status(500).json({ error: 'Failed to create device' })

    }
})

//=========================================================
// UPDATE
//=========================================================

/**
 * @swagger
 * /devices/updateDevice:
 *   put:
 *     summary: Update device information
 *     description: Update the name, status, or last seen timestamp of a specific device.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (if ID not provided)
 *               newDeviceName:
 *                 type: string
 *                 description: New name for the device
 *               status:
 *                 type: string
 *                 description: Updated device status
 *               lastSeen:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp of the last device activity
 *     responses:
 *       200:
 *         description: Device successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       400:
 *         description: Missing deviceId or deviceName.
 *       404:
 *         description: Device not found or no changes applied.
 *       500:
 *         description: Failed to update device.
 */
router.put('/updateDevice', async (req: Request, res: Response) => {
    try {
        const { deviceId, deviceName, newDeviceName, status, lastSeen } = req.body
        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const updated = await updateDevice({ deviceId, deviceName, newDeviceName, status, lastSeen })
        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })
        res.json(updated)
    } catch (err) {
        console.error('Update device error: ', err)
        res.status(500).json({ error: 'Failed to update device' })
    }
})


/**
 * @swagger
 * /devices/updateEnergyStats:
 *   put:
 *     summary: Insert or update energy statistics for a device
 *     description: Update total energy, average power, and maximum power for a device over a specific period.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (optional if deviceId is provided)
 *               periodType:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *                 description: The type of period for energy stats
 *               periodStart:
 *                 type: string
 *                 format: date-time
 *                 description: The starting date/time of the period
 *               totalEnergy:
 *                 type: number
 *                 description: Total energy consumed in this period
 *               avgPower:
 *                 type: number
 *                 description: Average power during this period
 *               maxPower:
 *                 type: number
 *                 description: Maximum power during this period
 *             required:
 *               - periodType
 *               - periodStart
 *               - totalEnergy
 *     responses:
 *       200:
 *         description: Energy statistics successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnergyDeviceStat'
 *       400:
 *         description: Missing required fields or invalid periodType.
 *       404:
 *         description: Device not found or no changes applied.
 *       500:
 *         description: Failed to update energy statistics.
 */
router.put('/updateEnergyStats', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const periodTypeRaw = req.body.periodType
        const periodStart = getString(req.body.periodStart)
        const totalEnergy = getNumber(req.body.totalEnergy)
        const avgPower = getNumber(req.body.avgPower)
        const maxPower = getNumber(req.body.maxPower)

        if (
            (!deviceId && !deviceName) ||
            !periodTypeRaw ||
            !periodStart ||
            totalEnergy === undefined
        ) {
            return res.status(400).json({ error: 'Missing deviceId/deviceName, periodType, periodStart, or totalEnergy' })
        }

        if (!isEnergyPeriodType(periodTypeRaw)) {
            return res.status(400).json({ error: 'Invalid periodType' })
        }

        const updated = await upsertDeviceEnergyStats({ deviceId, deviceName, periodType: periodTypeRaw, periodStart, totalEnergy, avgPower, maxPower })
        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })
        res.json(updated)
    } catch (err) {
        console.error('Update energy stat error: ', err)
        res.status(500).json({ error: 'Failed to update energy stat' })
    }
})


/**
 * @swagger
 * /devices/updateDeviceImage:
 *   put:
 *     summary: Update a device's image
 *     description: Insert or update a PNG or JPEG image for a device using Base64 encoding.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (optional if deviceId is provided)
 *               imageUrl:
 *                 type: string
 *                 description: Base64-encoded PNG or JPEG image data
 *             required:
 *               - imageBase64
 *     responses:
 *       200:
 *         description: Device image successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceMetadata'
 *       400:
 *         description: Missing deviceId/deviceName or imageUrl.
 *       404:
 *         description: Device not found or no changes applied.
 *       500:
 *         description: Failed to update device image.
 */
router.put('/updateDeviceImage', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const imageBase64 = getString(req.body.imageBase64)

        if ((!deviceId && !deviceName) || !imageBase64) return res.status(400).json({ error: 'Missing deviceId/deviceName or imageBase64' })

        const updated = await upsertDeviceImage({ deviceId, deviceName, imageBase64 })
        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })
        res.json(updated)
    } catch (err) {
        console.error('Update device image error: ', err)
        res.status(500).json({ error: 'Failed to update device image' })
    }
})


/**
 * @swagger
 * /devices/updateDevicePolicy:
 *   put:
 *     summary: Update a device's policy
 *     description: Insert or update policy settings for a specific device, including energy limits and allowed hours.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (optional if deviceId is provided)
 *               dailyEnergyLimit:
 *                 type: number
 *                 description: Maximum allowed energy consumption per day
 *               allowedStart:
 *                 type: string
 *                 description: Allowed usage start time (e.g., "08:00")
 *               allowedEnd:
 *                 type: string
 *                 description: Allowed usage end time (e.g., "20:00")
 *               isEnforced:
 *                 type: boolean
 *                 description: Whether the policy is currently enforced
 *     responses:
 *       200:
 *         description: Device policy successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DevicePolicy'
 *       400:
 *         description: Missing deviceId/deviceName
 *       404:
 *         description: Device not found or no changes applied
 *       500:
 *         description: Failed to update device policy
 */
// router.put('/updateDevicePolicy', async (req: Request, res: Response) => {
//     try {
//         const deviceId = getNumber(req.body.deviceId)
//         const deviceName = getString(req.body.deviceName)
//         const dailyEnergyLimit = getNumber(req.body.dailyEnergyLimit)
//         const allowedStart = getString(req.body.allowedStart)
//         const allowedEnd = getString(req.body.allowedEnd)
//         const isEnforced = 
//             typeof req.body.isEnforced === 'boolean'
//                 ? req.body.isEnforced : undefined

//         if ((!deviceId && !deviceName)) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

//         const updated = await upsertDevicePolicy({ deviceId, deviceName, dailyEnergyLimit, allowedStart, allowedEnd, isEnforced })        
//         if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })
//         res.json(updated)
//     } catch (err) {
//         console.error('Update device policy error: ', err)
//         res.status(500).json({ error: 'Failed to update device policy' })
//     }
// })


/**
 * @swagger
 * /devices/updateAllReadings:
 *   put:
 *     summary: Update all device measurement fields and increment cumulative energy
 *     description: >
 *       Updates voltage, current, and power readings for a device, and increments the cumulative energy by a specified amount.
 *       This does not overwrite the existing cumulative energy; it adds to it.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: 
 *               - voltage
 *               - current
 *               - power
 *               - energyIncrement
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (optional if deviceId is provided)
 *               voltage:
 *                 type: number
 *                 description: New voltage reading (V)
 *                 example: 120.5
 *               current:
 *                 type: number
 *                 description: New current reading (A)
 *                 example: 0.85
 *               power:
 *                 type: number
 *                 description: New power reading (W). Overwrites the previous measurement.
 *                 example: 102.4
 *               energyIncrement:
 *                 type: number
 *                 description: >
 *                   Amount of energy (Wh) to add to the existing cumulative energy.
 *                   Does not overwrite the stored cumulative energy; it increments it.
 *                 example: 0.12
 *     responses:
 *       200:
 *         description: New device reading entry recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing one or more required fields (deviceId/deviceName, voltage, current, power, energyIncrement).
 *       500:
 *         description: Failed to update all readings.
 */
router.put('/updateAllReadings', async (req: Request, res: Response) => {
    try {

        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const { voltage, current, power, energyIncrement } = req.body

        if ((!deviceId && !deviceName) || voltage === undefined || current === undefined || power === undefined || energyIncrement === undefined)
            return res.status(400).json({ error: 'Missing one of: deviceId/deviceName, voltage, current, power, or energyIncrement' })

        const latest = await getLatest(deviceId, deviceName)
        const newCumulative = (latest.cumulative_energy ?? 0) + energyIncrement

        const updated = await addReadings({
            deviceId,
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
 * /devices/updateEnergyUsage:
 *   put:
 *     summary: Update the cumulative energy usage for a device
 *     description: >
 *       Updates the cumulative energy reading for a device while keeping the last recorded voltage, current, and power unchanged.
 *       Either `deviceId` or `deviceName` must be provided to identify the device.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cumulativeEnergy
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device to update (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device to update (optional if deviceId is provided)
 *               cumulativeEnergy:
 *                 type: number
 *                 description: The new cumulative energy value to set (Wh)
 *                 example: 123.45
 *     responses:
 *       200:
 *         description: The updated device reading entry.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing deviceId/deviceName or cumulativeEnergy.
 *       500:
 *         description: Failed to update energy usage.
 */
router.put('/updateEnergyUsage', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const { cumulativeEnergy } = req.body

        if ((!deviceId && !deviceName) || cumulativeEnergy === undefined)
            return res.status(400).json({ error: 'Missing deviceId/deviceName or cumulativeEnergy' })

        const latest = await getLatest(deviceId, deviceName)

        const updated = await addReadings({
            deviceId,
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
 * /devices/updatePower:
 *   put:
 *     summary: Update the power reading for a device
 *     description: >
 *       Updates the power reading of a device while keeping the last recorded voltage, current, and cumulative energy unchanged.
 *       Either `deviceId` or `deviceName` must be provided to identify the device.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - power
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device (optional if deviceId is provided)
 *               power:
 *                 type: number
 *                 description: The new power reading (W) to set
 *                 example: 95.5
 *     responses:
 *       200:
 *         description: The updated device reading entry.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing deviceId/deviceName or power.
 *       500:
 *         description: Failed to update power.
 */
router.put('/updatePower', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const { power } = req.body

        if ((!deviceId && !deviceName) || power === undefined)
            return res.status(400).json({ error: 'Missing deviceId/deviceName or power' })

        const latest = await getLatest(deviceId, deviceName)

        const updated = await addReadings({
            deviceId,
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
 * @swagger
 * /devices/updateCurrentAndVoltage:
 *   put:
 *     summary: Update the current and voltage readings for a device
 *     description: >
 *       Updates the current and voltage readings of a device while keeping the last recorded power and cumulative energy unchanged.
 *       Either `deviceId` or `deviceName` must be provided to identify the device.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current
 *               - voltage
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device (optional if deviceId is provided)
 *               current:
 *                 type: number
 *                 description: The new current reading (A) to set
 *                 example: 0.85
 *               voltage:
 *                 type: number
 *                 description: The new voltage reading (V) to set
 *                 example: 120.5
 *     responses:
 *       200:
 *         description: The updated device reading entry.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceReading'
 *       400:
 *         description: Missing deviceId/deviceName, current, or voltage.
 *       500:
 *         description: Failed to update current and voltage.
 */
router.put('/updateCurrentAndVoltage', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)
        const { current, voltage } = req.body

        if ((!deviceId && !deviceName) || current === undefined || voltage === undefined)
            return res.status(400).json({ error: 'Missing deviceId/deviceName, current, or voltage' })

        const latest = await getLatest(deviceId, deviceName)

        const updated = await addReadings({
            deviceId,
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
        res.status(500).json({ error: 'Failed to update current and voltage' })
    }
})

//=========================================================
// DELETE
//=========================================================

/**
 * @swagger
 * /devices/deleteDevice:
 *   delete:
 *     summary: Soft-delete a device from the database
 *     description: >
 *       Marks a device as deleted. Either `deviceId` or `deviceName` must be provided in the request body.
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: integer
 *                 description: The ID of the device (optional if deviceName is provided)
 *               deviceName:
 *                 type: string
 *                 description: The name of the device (optional if deviceId is provided)
 *             required: []
 *     responses:
 *       200:
 *         description: The device was soft-deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The ID of the deleted device
 *       400:
 *         description: Missing deviceId or deviceName.
 *       404:
 *         description: Device not found.
 *       500:
 *         description: Failed to delete the device.
 */
router.delete('/deleteDevice', async (req: Request, res: Response) => {
    try {
        const deviceId = getNumber(req.body.deviceId)
        const deviceName = getString(req.body.deviceName)

        if (!deviceId && !deviceName) return res.status(400).json({ error: 'Missing deviceId or deviceName' })

        const deleted = await deleteDevice({ deviceId, deviceName })
        if (!deleted) return res.status(404).json({ error: 'Device not found' })
        res.json(deleted)
    } catch (err) {
        console.error('Delete device error', err)
        res.status(500).json({ error: 'Failed to delete device' })
    }
})

export default router
