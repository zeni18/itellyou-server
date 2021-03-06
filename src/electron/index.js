const UUID = require('uuid');
const { app , BrowserView , BrowserWindow } = require('electron')

app.disableDomainBlockingFor3DAPIs()
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {
    if (process.platform != 'darwin') {
        app.quit()
    }
})

let views = {}
let browserWindow
const createWindow = options => {
    browserWindow = new BrowserWindow({
        width: 1000,
        height: 1000,
        show:false,
        paintWhenInitiallyHidden:false,
        webPreferences:{
            devTools:false,
        },
        ...options
    })
    browserWindow.on('closed',() => {
        views = {}
    })
    return browserWindow
}

const readHtml = async id => {
    if(views[id]){
        return await views[id].view.webContents.executeJavaScript("var html = document.getElementsByTagName('html')[0].outerHTML;html",true)
    }
}
module.exports.createWindow = createWindow
const createView = (url , filter , onReady) => {
    const id = UUID.v4() + "-" + (new Date().getTime())
   
    const view = new BrowserView({
        webPreferences:{
            devTools:false,
        },
    })
    browserWindow.addBrowserView(view)

    views[id] = {
        id,
        url,
        view,
        requests:[],
        completeds:[]
    }

    const reader = time => {
        return setTimeout(async () => {
            const html = await readHtml(id)
            views[id].view.destroy()
            delete views[id]
            if(onReady) onReady(html)
        },time)
    }

    let timeoutRead
    view.webContents.on("dom-ready",event => {
        //获取不到数据就直接取html
        timeoutRead = setTimeout(() => {
            if(views[id].requests.length === 0){
                reader(1)
            }
        },600)
    })

    let waitRead

    const { urls , exclude } = filter
 
    view.webContents.session.webRequest.onBeforeRequest({urls}, (details, callback) => {
        if(!exclude || !exclude(details)) {
            if(waitRead) clearTimeout(waitRead)
            if(timeoutRead) clearTimeout(timeoutRead)
            views[id].requests.push(details.url)
        }
        callback(details)
    })

    view.webContents.session.webRequest.onCompleted({urls}, details => {
        if(exclude && exclude(details)) return
        if(!views[id]) return
        views[id].completeds.push(details.url)
        if(views[id].requests.length === views[id].completeds.length){
            waitRead = setTimeout(() => {
                clearTimeout(timeoutRead)
                reader(10)
            },100)
        }
    })
    view.webContents.session.webRequest.onErrorOccurred({urls}, details => {
        if(exclude && exclude(details)) return
        if(!views[id]) return
        views[id].completeds.push(details.url)
        if(views[id].requests.length === views[id].completeds.length){
            waitRead = setTimeout(() => {
                clearTimeout(timeoutRead)
                reader(10)
            },100)
        }
    })

    view.webContents.loadURL(url)
    
    return views[id]
}
module.exports.createView = createView

app.on('ready',() => {
    createWindow()
})