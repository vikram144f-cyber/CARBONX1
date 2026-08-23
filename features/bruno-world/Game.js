import { Events } from './Events.js'

/**
 * Small CARBONX-owned context bridge for Bruno's browser-side primitives.
 * The original Game singleton owns the whole folio application; CARBONX only
 * supplies the scene, camera, clock, player and pointer state those primitives
 * need.
 */
export class Game
{
    static instance = null

    static getInstance()
    {
        if(!Game.instance)
            Game.instance = new Game()

        return Game.instance
    }

    static configure({ scene, camera, domElement, width, height } = {})
    {
        const game = Game.getInstance()
        if(scene) game.scene = scene
        if(camera)
        {
            game.camera = camera
            game.view.camera = camera
        }
        if(domElement)
        {
            game.domElement = domElement
            game.canvasElement = domElement
            game.viewport.domElement = domElement
        }
        if(typeof width === 'number') game.viewport.width = width
        if(typeof height === 'number') game.viewport.height = height
        game.viewport.ratio = game.viewport.height ? game.viewport.width / game.viewport.height : 1
        return game
    }

    constructor()
    {
        this.scene = null
        this.camera = null
        this.domElement = null
        this.canvasElement = null
        this.debug = { active: false }
        this.quality = { level: 1 }
        this.viewport = {
            domElement: null,
            width: typeof window === 'undefined' ? 1 : window.innerWidth,
            height: typeof window === 'undefined' ? 1 : window.innerHeight,
            ratio: 1,
        }
        this.player = {
            position: { x: 0, y: 0, z: 0 },
            position2: { x: 0, y: 0 },
        }
        this.inputs = {
            events: new Events(),
            pointer: { current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
            actions: new Map(),
            addActions: (actions = []) => {
                for(const action of actions)
                    this.inputs.actions.set(action.name, { ...action, active: false, value: 0, trigger: null })
            },
        }
        this.view = {
            camera: null,
            focusPoint: { position: { x: 0, y: 0, z: 0 } },
            optimalArea: { radius: Infinity },
        }
        this.ticker = {
            delta: 0,
            deltaScaled: 0,
            elapsed: 0,
            events: new Events(),
            wait: (frames, callback) => setTimeout(callback, Math.max(0, frames) * 16),
        }
    }

    tick(delta)
    {
        this.ticker.delta = Math.min(0.05, Math.max(0, delta))
        this.ticker.deltaScaled = this.ticker.delta
        this.ticker.elapsed += this.ticker.delta
        this.ticker.events.trigger('tick')
    }
}
