// rest_api/routes/devices.ts
import { Router, Request, Response } from 'express'
import { 
    getAllDevices,
    getDeviceById,
    getAllDevicesByUserId,
    addDevice,
    updateDevice,
    deleteDevice,
} from '../../pg_db/queries/devices'

const router = Router()

/**
 * GET /api/devices/getAllDevices - list devices
 */
router.get('/getAllDevices', async (req: Request, res: Response) => {
    try {
        const devices = await getAllDevices()
        res.json(devices)
    
    } catch(err) {
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
        if (Number.isNaN(id))
            return res.status(400).json({ error: 'Invalid id' })

        const device = await getDeviceById(id)
        if (!device)
            return res.status(404).json({ error: 'Device not found' })

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
        if (Number.isNaN(id))
            return res.status(400).json({ error: 'Invalid id' })


        const devices = await getAllDevicesByUserId(id)
        if (devices.length === 0)
            return res.status(404).json({ error: 'No devices found for this user' })

        res.json(devices)

    } catch (err) {
        console.error('Get devices by user ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})


/**
 * POST /api/devices/addDeviceMap - create device and map owner
 */
router.post('/addDeviceMap', async (req: Request, res: Response) => {
    try {
        const { name, userId } = req.body
        if (!name || !userId)
            return res.status(400).json({ error: 'Missing name or userId' })

        const device = await addDevice({ name, userId })
        res.status(201).json(device)

    } catch (err: any) {
        if (err?.code === '23505')
            return res.status(409).json({ error:'Device name already exists' })
        console.error('Failed to create device', err)
        res.status(500).json({ error: 'Failed to create device' })

    }
})


/**
 * PUT /api/devices/updateDevice/:id - partial update
 */

router.put('/updateDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id))
            return res.status(400).json({ error: 'Invalid id' })

        const payload: any = {}
        if (req.body.name !== undefined) 
            payload.name = req.body.name
        
        if (req.body.status !== undefined)
            payload.status = req.body.status

        if (req.body.last_seen !== undefined)
            payload.last_seen = req.body.last_seen

        payload.id = id

        const updated = await updateDevice(payload)
        if (!updated)
            return res.status(404).json({ error: 'Device not found or no changes applied' })

        res.json(updated)

    } catch (err) {
        console.error('Update device error: ', err)
        res.status(500).json({ error: 'Failed to update device' })
    }
})


/**
 * DELETE /api/devices/deleteDevice/:id - soft delete
 */
router.delete('/deleteDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id))
            return res.status(400).json({ error: 'Invalid id' })

        const deleted = await deleteDevice(id)
        if (!deleted) 
            return res.status(404).json({ error: 'Device not found' })

        res.json(deleted)
    } catch (err) {
        console.error('Delete device error', err)
        res.status(500).json({ error: 'Failed to delete device' })
    }
})

export default router
