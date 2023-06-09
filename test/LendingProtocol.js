const { expect } = require("chai")
const { ethers } = require("hardhat")

async function getEthBalance(address) {
    const provider = ethers.provider;
    const balance = await provider.getBalance(address);
    return balance;
  }
  

describe("Lending Protocol", () => {
	let collateralRatio = 1
	let owner, lendingContract

	beforeEach(async () => {
		;[owner, lender1, lender2, borrower1, borrower2, _] =
			await ethers.getSigners()

		CollateralToken = await ethers.getContractFactory("CollateralToken")
		tokenContract = await CollateralToken.deploy()
		await tokenContract.deployed()
		console.log(`Token Address ${tokenContract.address}`)

		LendingProtocol = await ethers.getContractFactory("LendingProtocol")
		lendingContract = await LendingProtocol.deploy(
			collateralRatio,
			tokenContract.address
		)
		await lendingContract.deployed()
	})

	describe("Owner Operations", async () => {
		it("should assign correct values in constructor", async () => {
			expect(await lendingContract.getCollateralRatio()).equal(
				collateralRatio
			)
			expect(await lendingContract.owner()).equal(owner.address)
		})
	})

	describe("Add Liquidity", async () => {
		it("should throw error if amount <= 0", async () => {
			const amount = 0
			await expect(
				lendingContract.connect(lender1).addLiquidity(amount)
			).to.be.revertedWith("must be greater then zero")
		})

		it("should add liquidity if amount > 0", async () => {
			// Given
			const amount = 100
			await tokenContract.transfer(lender1.address, amount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, amount)

			let beforeAdding = await lendingContract.getLiquidity()
			let beforeLenderBalance = await lendingContract.getBalance(
				lender1.address
			)

			// When
			await lendingContract.connect(lender1).addLiquidity(amount)

			// Then
			let afterAdding = await lendingContract.getLiquidity()
			let afterLenderBalance = await lendingContract.getBalance(
				lender1.address
			)

			expect(afterAdding).equal(beforeAdding + amount)
			expect(afterLenderBalance).equal(beforeLenderBalance + amount)
		})
	})

	describe("Borrow Funds", async () => {
		it("should throw error if amount <= 0", async () => {
			const amount = 0
			await expect(
				lendingContract.connect(borrower1).borrow(amount)
			).to.be.revertedWith("must be greater then zero")
		})

		it("should throw error if amount > liquidity", async () => {
			const amount = 10
			await expect(
				lendingContract.connect(borrower1).borrow(amount)
			).to.be.revertedWith("not enough liquidity")
		})

		it("should be able to borrow token by providing enough eth", async () => {
			// Given
			const liquidityAmount = 100
			const borrowAmount = 50
			await tokenContract.transfer(lender1.address, liquidityAmount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, liquidityAmount)

			await lendingContract.connect(lender1).addLiquidity(liquidityAmount)

			let liquidityBeforeBorrowing = await lendingContract.getLiquidity()
			let userAmountBeforeBorrow =
				await lendingContract.getBorrowAmountOfUser(borrower1.address)

			// When
			await lendingContract
				.connect(borrower1)
				.borrow(borrowAmount, { value: ethers.utils.parseEther("50") })

			// Then
			let liquidityAfterBorrowing = await lendingContract.getLiquidity()
			expect(liquidityAfterBorrowing).equal(
				liquidityBeforeBorrowing - borrowAmount
			)

			let userAmountAfterBorrow =
				await lendingContract.getBorrowAmountOfUser(borrower1.address)
			expect(userAmountAfterBorrow).equal(
				userAmountBeforeBorrow + borrowAmount
			)
		})
	})

	describe("Withraw Liquidity", () => {
		it("should throw error if amount <= 0", async () => {
			const amount = 0
			await expect(
				lendingContract.connect(lender1).withdraw(amount)
			).to.be.revertedWith("must be greater then zero")
		})

		it("should throw error if amount > liquidity", async () => {
			const amount = 10
			await expect(
				lendingContract.connect(lender1).withdraw(amount)
			).to.be.revertedWith("liquidity not available")
		})

		it("should throw error if amount > user balance", async () => {
			// Given
			const lendingAmount = 10
			const withdrawAmount = 15

			await tokenContract.transfer(lender1.address, lendingAmount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, lendingAmount)
			await lendingContract.connect(lender1).addLiquidity(lendingAmount)

			await tokenContract.transfer(lender2.address, lendingAmount)
			await tokenContract
				.connect(lender2)
				.approve(lendingContract.address, lendingAmount)
			await lendingContract.connect(lender2).addLiquidity(lendingAmount)

			// When & Then
			await expect(
				lendingContract.connect(lender1).withdraw(withdrawAmount)
			).to.be.revertedWith("not enough balance")
		})

		it("user should withdraw its own iquiduty amount ", async () => {
			// Given
			const lendingAmount = 100
			const withdrawAmount = 50

			await tokenContract.transfer(lender1.address, lendingAmount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, lendingAmount)
			await lendingContract.connect(lender1).addLiquidity(lendingAmount)

			await tokenContract.transfer(lender2.address, lendingAmount)
			await tokenContract
				.connect(lender2)
				.approve(lendingContract.address, lendingAmount)
			await lendingContract.connect(lender2).addLiquidity(lendingAmount)

			let liquidityBefore = await lendingContract.getLiquidity()
			let lender1BalanceBefore = await lendingContract.getBalance(
				lender1.address
			)
			let lender2BalanceBefore = await lendingContract.getBalance(
				lender2.address
			)

			// When
			await lendingContract.connect(lender1).withdraw(withdrawAmount)

			// Then
			let liquidityAfter = await lendingContract.getLiquidity()
			let lender1BalanceAfter = await lendingContract.getBalance(
				lender1.address
			)
			let lender2BalanceAfter = await lendingContract.getBalance(
				lender2.address
			)

			expect(liquidityAfter).equal(liquidityBefore - withdrawAmount)
			expect(lender1BalanceAfter).equal(
				lender1BalanceBefore - withdrawAmount
			)
			expect(lender2BalanceAfter).equal(lender2BalanceBefore)
		})
	})

    describe("Repay Borrowed Tokens", () => {
		it("should throw error if amount <= 0", async () => {
			const amount = 0
			await expect(
				lendingContract.connect(borrower1).repay(amount)
			).to.be.revertedWith("must be greater then zero")
		})

		it("should throw error if amount < borrow amount", async () => {
			// Given
			const liquidityAmount = 100
			const borrowAmount = 50
			await tokenContract.transfer(lender1.address, liquidityAmount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, liquidityAmount)

			await lendingContract.connect(lender1).addLiquidity(liquidityAmount)
			await lendingContract
				.connect(borrower1)
				.borrow(borrowAmount, { value: ethers.utils.parseEther("50") })

			// When & Then
			const repayAmount = 60
			await expect(
				lendingContract.connect(borrower1).repay(repayAmount)
			).to.be.revertedWith("not enough balance")
		})

		/* failing test */
		it("should be able to repay borrowed tokens", async () => {
			// Given
			const liquidityAmount = 100
			const borrowAmount = 50
			const amount = 50
			await tokenContract.transfer(lender1.address, liquidityAmount)
			await tokenContract
				.connect(lender1)
				.approve(lendingContract.address, liquidityAmount)

			await lendingContract.connect(lender1).addLiquidity(liquidityAmount)
			await lendingContract
				.connect(borrower1)
				.borrow(borrowAmount, { value: ethers.utils.parseEther("50") })

            let contractEthBalance = await getEthBalance(lendingContract.address)
            console.log(`Eth Balance Contract: ${ethers.utils.formatEther(contractEthBalance)}`)

			let contractTokenBalanceBefore = await tokenContract.balanceOf(
				lendingContract.address
			)
			let liquidityBeforeRepay = await lendingContract.getLiquidity()

			let userEthBalanceBeforeRepay = await getEthBalance(
				borrower1.address
			)
            console.log(`Eth Balance Before: ${ethers.utils.formatEther(userEthBalanceBeforeRepay)}`)

			let userBorrowAmountBeforeRepay =
				await lendingContract.getBorrowAmountOfUser(borrower1.address)

			// When
			await tokenContract
				.connect(borrower1)
				.approve(lendingContract.address, borrowAmount)
			await lendingContract.connect(borrower1).repay(borrowAmount)

			// Then
			let contractTokenBalanceAfter= await tokenContract.balanceOf(
				lendingContract.address
			)
			expect(contractTokenBalanceBefore.add(borrowAmount)).equal(contractTokenBalanceAfter)

			let liquidityAfterRepay = await lendingContract.getLiquidity()
            expect(liquidityBeforeRepay.add(amount)).equal(liquidityAfterRepay)

            
			let userBorrowAmountAfterRepay =
            await lendingContract.getBorrowAmountOfUser(borrower1.address)
            
			expect(userBorrowAmountBeforeRepay.sub(borrowAmount)).equal(
                userBorrowAmountAfterRepay
                )
            let userEthBalanceAfterRepay = await borrower1.getBalance()
			console.log(
				`Eth Balance After: ${ethers.utils.formatEther(
					userEthBalanceAfterRepay
				)}`
			)
			expect(userEthBalanceAfterRepay).greaterThan(userEthBalanceBeforeRepay)
		})
	})
})
