import { expect } from 'chai';
import { ethers } from 'hardhat';
import { utils, constants } from 'ethers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MockINST, DelegationHolder } from '../typechain';

describe('DelegationHolder', () => {
  let splitter: SignerWithAddress;
  let alice: SignerWithAddress;
  let instToken: MockINST;
  let holder: DelegationHolder;

  beforeEach(async () => {
    [splitter, alice] = await ethers.getSigners();

    const MockINSTFactory = await ethers.getContractFactory('MockINST');
    instToken = <MockINST>await MockINSTFactory.deploy();

    const DelegationHolderFactory = await ethers.getContractFactory(
      'DelegationHolder',
    );
    holder = <DelegationHolder>(
      await DelegationHolderFactory.connect(splitter).deploy()
    );
  });

  describe('Check constructor and initial values', () => {
    it('check inital values', async () => {
      expect(await holder.owner()).to.be.equal(splitter.address);
    });
  });

  describe('#initialize', () => {
    it('it reverts if inst token is address(0)', async () => {
      await expect(
        holder
          .connect(splitter)
          .initialize(constants.AddressZero, alice.address),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if delegatee is address(0)', async () => {
      await expect(
        holder
          .connect(splitter)
          .initialize(instToken.address, constants.AddressZero),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if msg.sender is not owner(splitter)', async () => {
      await expect(
        holder.connect(alice).initialize(instToken.address, alice.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('initialize holder contract', async () => {
      await holder
        .connect(splitter)
        .initialize(instToken.address, alice.address);

      expect(await holder.instToken()).to.be.eq(instToken.address);
      expect(await holder.delegatee()).to.be.eq(alice.address);
      expect(await instToken.delegates(holder.address)).to.be.eq(alice.address);
    });

    it('it reverts if alraedy initialized', async () => {
      await holder
        .connect(splitter)
        .initialize(instToken.address, alice.address);

      await expect(
        holder.connect(splitter).initialize(instToken.address, alice.address),
      ).to.be.revertedWith('AlreadyInitialized()');
    });
  });

  describe('#withdraw', () => {
    const amount = utils.parseEther('100');

    beforeEach(async () => {
      await holder
        .connect(splitter)
        .initialize(instToken.address, alice.address);
      await instToken.mint(holder.address, utils.parseEther('300'));
    });

    it('it reverts if to is address(0)', async () => {
      await expect(
        holder.connect(splitter).withdraw(constants.AddressZero, 10),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if amount is 0', async () => {
      await expect(
        holder.connect(splitter).withdraw(alice.address, 0),
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('it reverts if msg.sender is not owner(alice)', async () => {
      await expect(
        holder.connect(alice).withdraw(alice.address, 10),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('withdraw inst token', async () => {
      const balanceBefore = await instToken.balanceOf(holder.address);

      await holder.connect(splitter).withdraw(alice.address, amount);

      expect(await instToken.balanceOf(alice.address)).to.be.eq(amount);
      expect(await instToken.balanceOf(holder.address)).to.be.eq(
        balanceBefore.sub(amount),
      );
    });
  });
});
