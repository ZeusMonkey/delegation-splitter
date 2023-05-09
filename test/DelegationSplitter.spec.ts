import { expect } from 'chai';
import { ethers } from 'hardhat';
import { utils, constants } from 'ethers';
import type { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  MockINST,
  DelegationSplitter,
  DelegationHolder__factory,
} from '../typechain';

describe('DelegationSplitter', () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let instToken: MockINST;
  let splitter: DelegationSplitter;

  let DelegationHolderFactory: DelegationHolder__factory;

  beforeEach(async () => {
    [alice, bob, carol] = await ethers.getSigners();

    const MockINSTFactory = await ethers.getContractFactory('MockINST');
    instToken = <MockINST>await MockINSTFactory.deploy();

    const DelegationSplitterFactory = await ethers.getContractFactory(
      'DelegationSplitter',
    );
    splitter = <DelegationSplitter>(
      await DelegationSplitterFactory.connect(alice).deploy(instToken.address)
    );

    await instToken.mint(splitter.address, utils.parseEther('100000'));

    DelegationHolderFactory = await ethers.getContractFactory(
      'DelegationHolder',
    );
  });

  describe('Check constructor and initial values', () => {
    it('check inital values', async () => {
      expect(await splitter.owner()).to.be.equal(alice.address);
      expect(await splitter.instToken()).to.be.equal(instToken.address);
    });

    it('it reverts if inst token is zero', async () => {
      const DelegationSplitterFactory = await ethers.getContractFactory(
        'DelegationSplitter',
      );

      await expect(
        DelegationSplitterFactory.deploy(constants.AddressZero),
      ).to.be.revertedWith('ZeroAddress()');
    });
  });

  describe('#delegate', () => {
    const amount = utils.parseEther('100');

    it('it reverts if delegatee is address(0)', async () => {
      await expect(
        splitter.connect(alice).delegate(constants.AddressZero, 10),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if amount is 0', async () => {
      await expect(
        splitter.connect(alice).delegate(bob.address, 0),
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('it reverts if msg.sender is not owner(alice)', async () => {
      await expect(
        splitter.connect(bob).delegate(bob.address, 10),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('create new holder and initialize, then increase voting power', async () => {
      const holderAddr = await getHolderAddress(bob.address);
      expect(await isContract(holderAddr)).to.be.false;

      await splitter.connect(alice).delegate(bob.address, amount);

      const holder = DelegationHolderFactory.attach(holderAddr);
      expect(await isContract(holderAddr)).to.be.true;

      // Check initialization status
      expect(await holder.delegatee()).to.be.eq(bob.address);
      expect(await holder.instToken()).to.be.eq(instToken.address);
      expect(await instToken.delegates(holder.address)).to.be.eq(bob.address);

      // Check voting power
      expect(await instToken.balanceOf(holder.address)).to.be.eq(amount);
      expect(await instToken.getVotes(bob.address)).to.be.eq(amount);
    });

    it('delegate with existing holder', async () => {
      // create holder
      const holderAddr = await getHolderAddress(bob.address);
      await splitter.connect(alice).delegate(bob.address, amount);

      // delegate with existing holder
      const newAmount = utils.parseEther('10');
      await splitter.connect(alice).delegate(bob.address, newAmount);

      const holder = DelegationHolderFactory.attach(holderAddr);

      // Check voting power
      expect(await instToken.balanceOf(holder.address)).to.be.eq(
        amount.add(newAmount),
      );
      expect(await instToken.getVotes(bob.address)).to.be.eq(
        amount.add(newAmount),
      );
    });

    it('emits Delegated event', async () => {
      const tx = await splitter.connect(alice).delegate(bob.address, amount);

      await expect(tx)
        .to.emit(splitter, 'Delegated')
        .withArgs(bob.address, amount);
    });
  });

  describe('#undelegate', () => {
    const delegatedAmount = utils.parseEther('1000');
    const amount = utils.parseEther('100');

    beforeEach(async () => {
      await splitter.connect(alice).delegate(bob.address, delegatedAmount);
    });

    it('it reverts if delegatee is address(0)', async () => {
      await expect(
        splitter
          .connect(alice)
          .undelegate(constants.AddressZero, 10, constants.AddressZero),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if amount is 0', async () => {
      await expect(
        splitter
          .connect(alice)
          .undelegate(bob.address, 0, constants.AddressZero),
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('it reverts if msg.sender is not owner(alice)', async () => {
      await expect(
        splitter
          .connect(bob)
          .undelegate(bob.address, 10, constants.AddressZero),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('undelegate and withdraw funds to splitter contract(if "to" is address(0))', async () => {
      const holderAddr = await getHolderAddress(bob.address);

      const balanceBefore = await instToken.balanceOf(splitter.address);

      await splitter
        .connect(alice)
        .undelegate(bob.address, amount, constants.AddressZero);

      // check splitter balance
      expect(await instToken.balanceOf(splitter.address)).to.be.eq(
        balanceBefore.add(amount),
      );

      // Check voting power
      expect(await instToken.balanceOf(holderAddr)).to.be.eq(
        delegatedAmount.sub(amount),
      );
      expect(await instToken.getVotes(bob.address)).to.be.eq(
        delegatedAmount.sub(amount),
      );
    });

    it('undelegate and withdraw funds to "to" address', async () => {
      const holderAddr = await getHolderAddress(bob.address);

      await splitter
        .connect(alice)
        .undelegate(bob.address, amount, carol.address);

      // check splitter balance
      expect(await instToken.balanceOf(carol.address)).to.be.eq(amount);

      // Check voting power
      expect(await instToken.balanceOf(holderAddr)).to.be.eq(
        delegatedAmount.sub(amount),
      );
      expect(await instToken.getVotes(bob.address)).to.be.eq(
        delegatedAmount.sub(amount),
      );
    });

    it('emits UnDelegated event', async () => {
      const tx = await splitter
        .connect(alice)
        .undelegate(bob.address, amount, constants.AddressZero);

      await expect(tx)
        .to.emit(splitter, 'UnDelegated')
        .withArgs(bob.address, amount);
    });
  });

  describe('#moveDelegation', () => {
    const delegatedAmount = utils.parseEther('1000');
    const amount = utils.parseEther('100');

    beforeEach(async () => {
      await splitter.connect(alice).delegate(bob.address, delegatedAmount);
    });

    it('it reverts if new delegatee is address(0)', async () => {
      await expect(
        splitter
          .connect(alice)
          .moveDelegation(bob.address, constants.AddressZero, amount),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if amount is 0', async () => {
      await expect(
        splitter.connect(alice).moveDelegation(bob.address, carol.address, 0),
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('it reverts if msg.sender is not owner(alice)', async () => {
      await expect(
        splitter
          .connect(bob)
          .moveDelegation(bob.address, carol.address, amount),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('it reverts if new delegatee is same as old delegatee', async () => {
      await expect(
        splitter
          .connect(alice)
          .moveDelegation(bob.address, bob.address, amount),
      ).to.be.revertedWith('SameAddress()');
    });

    it('move delegation to another address', async () => {
      const bobHolderAddr = await getHolderAddress(bob.address);
      const carolHolderAddr = await getHolderAddress(carol.address);

      await splitter
        .connect(alice)
        .moveDelegation(bob.address, carol.address, amount);

      // Check bob voting power
      expect(await instToken.balanceOf(bobHolderAddr)).to.be.eq(
        delegatedAmount.sub(amount),
      );
      expect(await instToken.getVotes(bob.address)).to.be.eq(
        delegatedAmount.sub(amount),
      );

      // Check carol voting power
      expect(await instToken.balanceOf(carolHolderAddr)).to.be.eq(amount);
      expect(await instToken.getVotes(carol.address)).to.be.eq(amount);
    });

    it('undelegate and withdraw funds to "to" address', async () => {
      const holderAddr = await getHolderAddress(bob.address);

      await splitter
        .connect(alice)
        .undelegate(bob.address, amount, carol.address);

      // check splitter balance
      expect(await instToken.balanceOf(carol.address)).to.be.eq(amount);

      // Check voting power
      expect(await instToken.balanceOf(holderAddr)).to.be.eq(
        delegatedAmount.sub(amount),
      );
      expect(await instToken.getVotes(bob.address)).to.be.eq(
        delegatedAmount.sub(amount),
      );
    });

    it('emits Delegated and UnDelegated event', async () => {
      const tx = await splitter
        .connect(alice)
        .moveDelegation(bob.address, carol.address, amount);

      await expect(tx)
        .to.emit(splitter, 'UnDelegated')
        .withArgs(bob.address, amount);

      await expect(tx)
        .to.emit(splitter, 'Delegated')
        .withArgs(carol.address, amount);
    });
  });

  describe('#withdraw', () => {
    const amount = utils.parseEther('100');

    it('it reverts if to is address(0)', async () => {
      await expect(
        splitter.connect(alice).withdraw(constants.AddressZero, 10),
      ).to.be.revertedWith('ZeroAddress()');
    });

    it('it reverts if amount is 0', async () => {
      await expect(
        splitter.connect(alice).withdraw(bob.address, 0),
      ).to.be.revertedWith('ZeroAmount()');
    });

    it('it reverts if msg.sender is not owner(alice)', async () => {
      await expect(
        splitter.connect(bob).withdraw(bob.address, 10),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('withdraw inst token', async () => {
      const balanceBefore = await instToken.balanceOf(splitter.address);

      await splitter.connect(alice).withdraw(bob.address, amount);

      expect(await instToken.balanceOf(bob.address)).to.be.eq(amount);
      expect(await instToken.balanceOf(splitter.address)).to.be.eq(
        balanceBefore.sub(amount),
      );
    });

    it('emits Withdrawn event', async () => {
      const tx = await splitter.connect(alice).withdraw(bob.address, amount);

      await expect(tx)
        .to.emit(splitter, 'Withdrawn')
        .withArgs(bob.address, amount);
    });
  });

  describe('#getHolder', () => {
    it('returns correct delegation holder contract address', async () => {
      expect(await splitter.getHolder(bob.address)).to.be.eq(
        await getHolderAddress(bob.address),
      );
    });
  });

  describe('#renounceOwnership', () => {
    it('it reverts', async () => {
      await expect(
        splitter.connect(alice).renounceOwnership(),
      ).to.be.revertedWith('ZeroAddress()');
    });
  });

  const getHolderAddress = async (delegatee: string): Promise<string> => {
    const salt = utils.solidityKeccak256(['address'], [delegatee]);
    return utils.getCreate2Address(
      splitter.address,
      salt,
      await splitter.INIT_CODE_HASH(),
    );
  };

  const isContract = async (addr: string): Promise<boolean> => {
    const code = await alice.provider.getCode(addr);
    return code !== '0x';
  };
});
