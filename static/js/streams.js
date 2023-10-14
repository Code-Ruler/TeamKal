
const APP_ID = 'a372f55b4d3b4a0ab1c11d37b03ef564'
const TOKEN = sessionStorage.getItem('token')
const CHANNEL = sessionStorage.getItem('room')
let UID = sessionStorage.getItem('UID')

let NAME = sessionStorage.getItem('name')

const client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})

let localTracks = []
let remoteUsers = {}

let joinAndDisplayLocalStream = async () => {
    document.getElementById('room-name').innerText = CHANNEL

    client.on('user-published', handleUserJoined)
    client.on('user-left', handleUserLeft)

    try{
        UID = await client.join(APP_ID, CHANNEL, TOKEN, UID)
    }catch(error){
        console.error(error)
        window.open('/', '_self')
    }
    
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()
    let videoTrack
    const p1 = Promise.resolve(localTracks)
    p1.then((v)=>{
        videoTrack = v[1]
    })

    console.log(videoTrack)
    console.log(localTracks[1])
    let member = await createMember()

    let player = `<div  class="video-container" id="user-container-${UID}">
                     <div class="video-player" id="user-${UID}"></div>
                     <div class="username-wrapper"><span class="user-name">${member.name}</span></div>
                  </div>`
    
    document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)
    localTracks[1].play(`user-${UID}`)
    await client.publish([localTracks[0], localTracks[1]])

    let URL = 'https://teachablemachine.withgoogle.com/models/KywtBNCNc/';
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    let model;
    let maxPredictions;

    // Load Teachable Machine model and metadata
    tmImage.load(modelURL, metadataURL).then(loadedModel => {
        model = loadedModel;
        maxPredictions = model.getTotalClasses();

        // Initialize Agora SDK and join the video call
        // ...

        // Capture user's camera video stream using LocalVideoTrack
        // const localVideoTrack = AgoraRTC.createCameraVideoTrack();

        const videoElement = document.createElement('video');
        videoElement.srcObject = new MediaStream([localTracks[1].getMediaStreamTrack()]);
        videoElement.play(); 
        // Create a canvas element to capture video frames
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // document.body.appendChild(canvas); // Add the canvas to the DOM if needed

        // Attach the video track to the canvas for capturing frames
        // localTracks[1].play(canvas);

        // Predict and control camera/mic based on Teachable Machine
        setInterval(() => {
            
            // Capture the current video frame onto the canvas
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // Get pixel data from the canvas
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tensor = tf.browser.fromPixels(imageData).resizeNearestNeighbor([224, 224]).toFloat();
            const expanded = tensor.expandDims();

            // Make predictions using the Teachable Machine model
            model.predict(expanded).then(predictions => {
                // ... rest of the code ...

                // Example: Turning off camera if certain class has high probability
                const classIndexToTurnOffCamera = 2; // Adjust class index
                const cameraOffThreshold = 0.9;

                if (predictions[classIndexToTurnOffCamera].probability > cameraOffThreshold) {
                    document.getElementById('camera-btn').addEventListener('click', toggleCamera)
 // Turn off camera
                } else {
                    document.getElementById('camera-btn').addEventListener('click', toggleCamera)
  // Turn on camera
                }

                // ... similar logic for microphone control ...
            }).catch(error => {
                console.error('Error predicting:', error);
            });
        }, 1000); // Adjust the interval as needed
    }).catch(error => {
        console.error('Error loading the Teachable Machine model:', error);
    });

}

let handleUserJoined = async (user, mediaType) => {
    remoteUsers[user.uid] = user
    await client.subscribe(user, mediaType)

    if (mediaType === 'video'){
        let player = document.getElementById(`user-container-${user.uid}`)
        if (player != null){
            player.remove()
        }

        let member = await getMember(user)

        player = `<div  class="video-container" id="user-container-${user.uid}">
            <div class="video-player" id="user-${user.uid}"></div>
            <div class="username-wrapper"><span class="user-name">${member.name}</span></div>
        </div>`

        document.getElementById('video-streams').insertAdjacentHTML('beforeend', player)
        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType === 'audio'){
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()
}

let leaveAndRemoveLocalStream = async () => {
    for (let i=0; localTracks.length > i; i++){
        localTracks[i].stop()
        localTracks[i].close()
    }

    await client.leave()
    //This is somewhat of an issue because if user leaves without actaull pressing leave button, it will not trigger
    deleteMember()
    window.open('/', '_self')
}

let toggleCamera = async (e) => {
    console.log('TOGGLE CAMERA TRIGGERED')
    if(localTracks[1].muted){
        await localTracks[1].setMuted(false)
        e.target.style.backgroundColor = '#fff'
    }else{
        await localTracks[1].setMuted(true)
        e.target.style.backgroundColor = 'rgb(255, 80, 80, 1)'
    }
}

let toggleMic = async (e) => {
    console.log('TOGGLE MIC TRIGGERED')
    if(localTracks[0].muted){
        await localTracks[0].setMuted(false)
        e.target.style.backgroundColor = '#fff'
    }else{
        await localTracks[0].setMuted(true)
        e.target.style.backgroundColor = 'rgb(255, 80, 80, 1)'
    }
}

let createMember = async () => {
    let response = await fetch('/create_member/', {
        method:'POST',
        headers: {
            'Content-Type':'application/json'
        },
        body:JSON.stringify({'name':NAME, 'room_name':CHANNEL, 'UID':UID})
    })
    let member = await response.json()
    return member
}


let getMember = async (user) => {
    let response = await fetch(`/get_member/?UID=${user.uid}&room_name=${CHANNEL}`)
    let member = await response.json()
    return member
}

let deleteMember = async () => {
    let response = await fetch('/delete_member/', {
        method:'POST',
        headers: {
            'Content-Type':'application/json'
        },
        body:JSON.stringify({'name':NAME, 'room_name':CHANNEL, 'UID':UID})
    })
    let member = await response.json()
}

window.addEventListener("beforeunload",deleteMember);

joinAndDisplayLocalStream()

document.getElementById('leave-btn').addEventListener('click', leaveAndRemoveLocalStream)
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)