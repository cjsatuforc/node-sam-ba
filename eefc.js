const EEFC_KEY = 0x5a;

const EEFC_FCMD_GETD = 0x0;
const EEFC_FCMD_WP = 0x1;
const EEFC_FCMD_WPL = 0x2;
const EEFC_FCMD_EWP = 0x3;
const EEFC_FCMD_EWPL = 0x4;
const EEFC_FCMD_EA = 0x5;
const EEFC_FCMD_SLB = 0x8;
const EEFC_FCMD_CLB = 0x9;
const EEFC_FCMD_GLB = 0xa;
const EEFC_FCMD_SGPB = 0xb;
const EEFC_FCMD_CGPB = 0xc;
const EEFC_FCMD_GGPB = 0xd;

/**
 * EEFC routing class
 */
class EefcFlash {
  /**
   * constructor
   * @param {SamBA} samBa class object
   * @param {number} addr address
   * @param {number} pages
   * @param {number} size
   * @param {number} planes
   * @param {number} lockRegions
   * @param {number} user
   * @param {number} stack
   * @param {number} regs
   * @param {boolean} canBrownout
   * @param {Object} flashBlob
   */
  constructor(samBa, addr, pages, size, planes, lockRegions, user, stack,
              regs, canBrownout, flashBlob) {
    this.samBa = samBa;
    this.addr = addr;
    this.pages = pages;
    this.size = size;
    this.planes = planes;
    this.lockRegions = lockRegions;
    this.user = user;
    this.stack = stack;
    this.regs = regs;
    this.canBrownout = canBrownout;
    this.flashBlob = flashBlob;

    this.EEFC0_FMR = (this.regs + 0x00);
    this.EEFC0_FCR = (this.regs + 0x04);
    this.EEFC0_FSR = (this.regs + 0x08);
    this.EEFC0_FRR = (this.regs + 0x0C);

    this.EEFC1_FMR = (this.regs + 0x200);
    this.EEFC1_FCR = (this.regs + 0x204);
    this.EEFC1_FSR = (this.regs + 0x208);
    this.EEFC1_FRR = (this.regs + 0x20C);

    this.bufferNum = 0;
  }

/**
 * EEFCFactory - generate an EEFC object based on the chipId provided
 * @param  {SamBA}  samBa  class object
 * @param  {number} chipId the chipId as reported by the machine
 * @return {EEFC}          the EEFC object associated with chipId
 */
  static EEFCFactory(samBa, chipId) {
    switch (chipId) {
      // SAM3X8n
      case 0x286e0a60: // 8H
      case 0x285e0a60: // 8E
      case 0x284e0a60: // 8C
      {
        let FlashBlob = require('./upload-blob/output/flasher-sam3x');
        return new EefcFlash(
            samBa,      // samBa
            0x80000,    // addr
            2048,       // pages
            256,        // size
            2,          // planes
            32,         // lockRegions
            0x20001000, // user
            0x20010000, // stack
            0x400e0a00, // regs
            false,       // canBrownout
            new FlashBlob()
            );
        break;
      }
      default:
        return null;
    }
  }

  /**
   * init
   * @return {Promise} Promise that will complete when the EEFC object
   *                   has finished initilizing.
   */
  init() {
    this.samBa.setJumpData(this.flashBlob.stack_address,
                           this.flashBlob.jump_address);

    return this.samBa.write(this.flashBlob._sfixed, this.flashBlob.blob)
      .then(()=>{
        return this.samBa.go(this.flashBlob.flashInit);
      })
      .then(()=>{
        return this.samBa.readWord(this.flashBlob.inited);
      })
      .then((data)=>{
        console.log(`inited: ${data.toString(16)}`);
        return Promise.resolve(); // pass an empty promise to maintain the chain
      });
  }

  /**
   * writePage - write the provided data tot he specified page
   * @param {number} page  the number of the page to store the data in
   * @param {Buffer} data  containing the data to be delivered tot he machine
   * @return {Promise}     Promise that, when fulfilled, the data has been
   *                       delievered to the machine
   */
  writePage(page, data) {
    let bufferAddr = this.bufferNum === 0
      ? this.flashBlob.buffer0
      : this.flashBlob.buffer1;
    this.bufferNum = this.bufferNum === 0 ? 1 : 0;

    return this.samBa.writeWord(this.flashBlob.bufferNum, bufferAddr)
      .then(()=>{
        return this.samBa.writeWord(this.flashBlob.flashPage, page);
      })
      .then(()=>{
        return this.samBa.write(bufferAddr, data);
      })
      .then(()=>{
        return this.samBa.go(this.flashBlob.flashPage);
      });
  }

  /**
   * wiatForDone - wait for FSR to go to 1
   * @param {number} plane The flash plane to wait for
   * @return {Promise}     Promise that is resolved once the flashStatus goes
   *                       to 1
   */
  waitForDone(plane) {
    return new Promise((f)=>{
      return samBa.readWord((plane == 0) ? this.EEFC0_FSR : this.EEFC1_FSR);
    })
    .then((data)=>{
      console.log(`FSP: ${data.toString(16)}`);
      if ((data & 1) === 1) {
        return f();
      } else {
        return waitForDone();
      }
    });
  }

}

module.exports = EefcFlash;