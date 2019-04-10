import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import Camera from 'react-html5-camera-photo'
import 'react-html5-camera-photo/build/css/index.css'
import { Spin, Alert, Input, Tooltip, Icon } from 'antd'
import { loadModels, getFullFaceDescription, createMatcher } from '../api/face'

// Import face profile
const JSON_PROFILE = require('../descriptors/face-db.json')

const WIDTH = 420
const HEIGHT = 420
const inputSize = 160
const face_scan_interval = 1500  // ms

class VideoInput extends Component {
  constructor(props) {
    super(props)
    this.webcam = React.createRef()
    this.state = {
      fullDesc: null,
      detections: null,
      descriptors: null,
      faceMatcher: null,
      match: null,
      facingMode: null,
      loading: true,
      showInput: false,
      faceDescCache: null,
    }
  }

  async componentWillMount() {
    await loadModels()
    let faceMatcher = await createMatcher(JSON_PROFILE)
    this.setState({ faceMatcher: faceMatcher, loading: false })
    await this.setInputDevice()
  }

  async setInputDevice() {
    let devices = await navigator.mediaDevices.enumerateDevices()
    devices = devices.filter(device => device.kind === 'videoinput')
    let state = { facingMode: { exact: 'environment' } }
    if (devices.length < 2) {
      state.facingMode = 'user'
    }
    this.setState(state)
    this.startCapture()
  }

  startCapture() {
    this.interval = setInterval(() => {
      this.capture()
    }, face_scan_interval)
  }

  componentWillUnmount() {
    clearInterval(this.interval)
  }

  async capture() {
    if (!this.webcam.current) {
      return null
    }
    let fullDesc = await getFullFaceDescription(
      this.webcam.current.libCameraPhoto.getDataUri({}),
      inputSize
    )
    if (!!fullDesc) {
      this.setState({
        detections: fullDesc.map(fd => fd.detection),
        descriptors: fullDesc.map(fd => fd.descriptor)
      })
    }

    if (!!this.state.descriptors && !!this.state.faceMatcher) {
      let match = this.state.descriptors.map(descriptor =>
        this.state.faceMatcher.findBestMatch(descriptor)
      )
      this.setState({ match })
    }
  }

  async onTakePhoto(dataUri) {
    const { faceMatcher } = this.state
    let fullDesc = await getFullFaceDescription(dataUri, inputSize)
    if (fullDesc.length !== 1) {
      return null
    }
    let match = faceMatcher.findBestMatch(fullDesc[0].descriptor)
    // if (match._label !== 'unknown') {
    //   return null
    // }
    this.setState({
      faceDescCache: fullDesc[0].descriptor,
      showInput: true
    })
  }

  async onPressEnter(name) {
    // modify face-db.json
    this.setState({ showInput: false })
    return null
  }

  render() {
    if (this.state.loading) {
      return (
        <Spin tip="Loading..." delay="200" size="large">
          <Alert
            message="模型加载中"
            description="第一次打开时间可能较长，如果一直在加载，这边推荐亲科学上网..."
            type="info"
          />
        </Spin>
      )
    }
    
    const { detections, match, facingMode, showInput } = this.state

    let videoConstraints = null
    let camera = facingMode === 'user' ? 'Front' : 'Back'
    if (facingMode) {
      videoConstraints = {
        width: WIDTH,
        height: HEIGHT,
        facingMode: facingMode
      }
    }

    let drawBox = null

    // draw bounding box
    if (detections) {
      drawBox = detections.map((detection, i) => {
        let _H = detection.box.height
        let _W = detection.box.width
        let _X = detection.box._x
        let _Y = detection.box._y
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                border: 'solid',
                borderColor: 'blue',
                height: _H,
                width: _W,
                transform: `translate(${_X}px,${_Y}px)`
              }}
            >
              {!!match && !!match[i] ? (
                <p
                  style={{
                    backgroundColor: 'blue',
                    border: 'solid',
                    borderColor: 'blue',
                    width: _W,
                    marginTop: 0,
                    color: '#fff',
                    transform: `translate(0px,${_H}px)`
                  }}
                >
                  {match[i]._label}  ({1 - match[i]._distance})
                </p>
              ) : null}
            </div>
          </div>
        )
      })
    }

    return (
      <div
        className="Camera"
        style={{
          display: 'flex',
          flexDirection: 'column',
          // alignItems: 'center'
        }}
      >
        <p>Camera: {camera}</p>
        <div style={{ position: 'relative' }}>
          {videoConstraints ? (
            <div className="inner" style={{ position: 'absolute' }}>
              <Camera
                audio={false}
                ref={this.webcam}
                screenshotFormat="image/jpeg"
                onTakePhoto={dataUri => this.onTakePhoto(dataUri)}
                // videoConstraints={videoConstraints}
              />
            </div>
          ) : null}
          {showInput ? (
            <Input
              placeholder="Enter your username"
              prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />}
              suffix={
                <Tooltip title="Extra information">
                  <Icon type="info-circle" style={{ color: 'rgba(0,0,0,.45)' }} />
                </Tooltip>
              }
              onPressEnter={name => this.onPressEnter(name)}
            />
          ) : null}
          {drawBox}
        </div>
      </div>
    )
  }
}

export default withRouter(VideoInput)
